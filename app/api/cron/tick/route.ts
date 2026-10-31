import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  dailyReviews,
  dayPlans,
  pushSubscriptions,
  reminderSent,
  routineLogs,
  routines,
  userSettings,
} from '@/src/db/schema';
import { NO_STORE_HEADERS, requireCron } from '@/src/lib/auth-server';
import { signDoneToken } from '@/src/lib/done-token';
import { evaluateReminderTick } from '@/src/lib/logic/tick-logic';
import { nowMinutes, todayLocal } from '@/src/lib/logic/dates';
import {
  resolveVapidConfig,
  sendWebPushToUserSubscriptions,
} from '@/src/lib/push-server';
import {
  DayPlan,
  ReminderSentRecord,
  Routine,
  RoutineBlock,
  RoutineAnchorType,
  RoutineAppliesOn,
  RoutineLog,
  UserSettings,
} from '@/src/lib/types';

const USER_BATCH_SIZE = 5;

async function processSingleUserTick(
  s: typeof userSettings.$inferSelect,
  vapidConfig: NonNullable<ReturnType<typeof resolveVapidConfig>>
): Promise<{ sent: number; skipped: number }> {
  const uid = s.userId;
  const tz = s.timezone || 'Asia/Kolkata';
  const rollover = s.dayRolloverHour ?? 4;
  const todayDate = todayLocal(tz, rollover);
  const currentMin = nowMinutes(tz);
  const nowMs = Date.now();

  const [
    dayPlanRows,
    activeRoutineRows,
    todayLogRows,
    todaySentRows,
    todayReviewRows,
    subRows,
  ] = await Promise.all([
    db
      .select()
      .from(dayPlans)
      .where(
        and(eq(dayPlans.userId, uid), eq(dayPlans.planDate, todayDate))
      ),
    db
      .select()
      .from(routines)
      .where(and(eq(routines.userId, uid), eq(routines.active, true))),
    db
      .select()
      .from(routineLogs)
      .where(
        and(eq(routineLogs.userId, uid), eq(routineLogs.logDate, todayDate))
      ),
    db
      .select()
      .from(reminderSent)
      .where(
        and(
          eq(reminderSent.userId, uid),
          eq(reminderSent.logDate, todayDate)
        )
      ),
    db
      .select({ id: dailyReviews.id })
      .from(dailyReviews)
      .where(
        and(
          eq(dailyReviews.userId, uid),
          eq(dailyReviews.reviewDate, todayDate)
        )
      ),
    db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, uid)),
  ]);

  if (subRows.length === 0) {
    return { sent: 0, skipped: 1 };
  }

  const mappedSettings: UserSettings = {
    userId: uid,
    timezone: tz,
    wakeTime: s.wakeTime,
    quietStart: s.quietStart,
    quietEnd: s.quietEnd,
    dayRolloverHour: rollover,
    dailyWorkloadMinutes: s.dailyWorkloadMinutes,
    dutyPromptTime: s.dutyPromptTime,
    reviewTime: s.reviewTime,
    maxRemindersPerDay: s.maxRemindersPerDay,
    pushEnabled: s.pushEnabled,
    lastActiveDate: s.lastActiveDate,
  };

  const dp = dayPlanRows[0];
  const mappedDayPlan: DayPlan | null = dp
    ? {
        id: dp.id,
        userId: uid,
        planDate: dp.planDate,
        isOff: dp.isOff,
        dutyStart: dp.dutyStart,
        minimumDay: dp.minimumDay,
        mainTaskId: dp.mainTaskId,
        locked: dp.locked,
      }
    : null;

  const mappedRoutines: Routine[] = activeRoutineRows.map((r) => ({
    id: r.id,
    userId: uid,
    goalId: r.goalId,
    originInboxItemId: r.originInboxItemId,
    title: r.title,
    block: (r.block as RoutineBlock) || 'anytime',
    anchorType: (r.anchorType as RoutineAnchorType) || 'clock',
    clockTime: r.clockTime,
    anchorOffsetMin: r.anchorOffsetMin,
    appliesOn: (r.appliesOn as RoutineAppliesOn) || 'all',
    daysOfWeek: Array.isArray(r.daysOfWeek)
      ? (r.daysOfWeek as number[])
      : [1, 2, 3, 4, 5, 6, 7],
    isMust: r.isMust,
    targetValue: r.targetValue,
    stepValue: r.stepValue,
    unit: r.unit,
    checkpoints: Array.isArray(r.checkpoints)
      ? (r.checkpoints as NonNullable<Routine['checkpoints']>)
      : null,
    active: r.active,
    sortOrder: r.sortOrder,
  }));

  const mappedLogs: RoutineLog[] = todayLogRows.map((l) => ({
    id: l.id,
    userId: uid,
    routineId: l.routineId,
    logDate: l.logDate,
    status: (l.status as RoutineLog['status']) || 'partial',
    value: l.value,
    completedAt: l.completedAt ? l.completedAt.toISOString() : null,
  }));

  const mappedSent: ReminderSentRecord[] = todaySentRows.map((r) => ({
    id: r.id,
    userId: uid,
    logDate: r.logDate,
    itemKey: r.itemKey,
    nudgeNo: r.nudgeNo,
    batchId: r.batchId,
    sentAt: r.sentAt.toISOString(),
  }));

  const evaluation = evaluateReminderTick({
    todayDate,
    nowMin: currentMin,
    nowMs,
    settings: mappedSettings,
    dayPlan: mappedDayPlan,
    routines: mappedRoutines,
    routineLogs: mappedLogs,
    reminderSentToday: mappedSent,
    hasDailyReviewToday: todayReviewRows.length > 0,
  });

  if (!evaluation.digestNotification || evaluation.dueItems.length === 0) {
    return { sent: 0, skipped: 1 };
  }

  // Idempotency: INSERT reminder_sent rows with ON CONFLICT DO NOTHING RETURNING
  const batchId = `batch_${crypto.randomUUID()}`;
  const rowsToInsert = evaluation.dueItems.map((item) => ({
    id: `rem_${crypto.randomUUID()}`,
    userId: uid,
    logDate: todayDate,
    itemKey: item.itemKey,
    nudgeNo: item.nudgeNo,
    batchId,
    sentAt: new Date(nowMs),
  }));

  const inserted = await db
    .insert(reminderSent)
    .values(rowsToInsert)
    .onConflictDoNothing({
      target: [
        reminderSent.userId,
        reminderSent.logDate,
        reminderSent.itemKey,
        reminderSent.nudgeNo,
      ],
    })
    .returning({ id: reminderSent.id });

  if (!inserted || inserted.length === 0) {
    return { sent: 0, skipped: 1 };
  }

  // Build notification payload with signed done-tokens (exp 6h)
  const exp = nowMs + 6 * 60 * 60 * 1000;
  const tokensByAction: Record<string, string> = {};
  let primaryToken: string | null = null;

  const notificationActions: Array<{ action: string; title: string }> = [];
  for (const act of evaluation.digestNotification.actions) {
    notificationActions.push({
      action: act.action,
      title: act.title,
    });
    if (act.routineId) {
      const signed = signDoneToken({
        uid,
        rid: act.routineId,
        date: todayDate,
        act: act.action,
        exp,
      });
      tokensByAction[act.action] = signed;
      if (!primaryToken) {
        primaryToken = signed;
      }

      // Attach 15-min snooze action for single routine/water reminder
      if (!tokensByAction.snooze) {
        tokensByAction.snooze = signDoneToken({
          uid,
          rid: act.routineId,
          date: todayDate,
          act: 'snooze',
          exp,
        });
        notificationActions.push({
          action: 'snooze',
          title: 'Snooze 15m',
        });
      }
    }
  }

  const pushPayload = {
    title: evaluation.digestNotification.title,
    body: evaluation.digestNotification.body,
    tag: `goalos-${todayDate}-${batchId.slice(0, 12)}`,
    url: '/?tab=today',
    actions: notificationActions,
    data: {
      url: '/?tab=today',
      token: primaryToken,
      tokens: tokensByAction,
    },
  };

  const delivery = await sendWebPushToUserSubscriptions(
    uid,
    subRows,
    pushPayload,
    vapidConfig
  );

  if (delivery.sent > 0) {
    return { sent: 1, skipped: 0 };
  }
  return { sent: 0, skipped: 1 };
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  const cronAuth = requireCron(req);
  if (!cronAuth.ok) {
    return NextResponse.json(
      { error: cronAuth.error },
      { status: cronAuth.status, headers: NO_STORE_HEADERS }
    );
  }

  const vapidConfig = resolveVapidConfig();
  if (!process.env.DONE_LINK_SECRET?.trim() || !vapidConfig) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const enabledUsers = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.pushEnabled, true));

    let sent = 0;
    let skipped = 0;

    for (let i = 0; i < enabledUsers.length; i += USER_BATCH_SIZE) {
      const batch = enabledUsers.slice(i, i + USER_BATCH_SIZE);
      const results = await Promise.all(
        batch.map((u) => processSingleUserTick(u, vapidConfig))
      );
      for (const r of results) {
        sent += r.sent;
        skipped += r.skipped;
      }
    }

    return NextResponse.json(
      {
        users: enabledUsers.length,
        sent,
        skipped,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[Cron Tick] Execution failed (${errClass}).`);
    return NextResponse.json(
      { error: 'Reminder tick execution failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
