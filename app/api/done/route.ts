import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, like, or } from 'drizzle-orm';
import { db } from '@/src/db';
import {
  reminderSent,
  routineLogs,
  routines,
  userSettings,
} from '@/src/db/schema';
import { NO_STORE_HEADERS } from '@/src/lib/auth-server';
import { verifyDoneToken } from '@/src/lib/done-token';
import { addDays, todayLocal } from '@/src/lib/logic/dates';
import { evaluateDoneAction } from '@/src/lib/logic/tick-logic';
import {
  Routine,
  RoutineAnchorType,
  RoutineAppliesOn,
  RoutineBlock,
  RoutineLog,
} from '@/src/lib/types';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 4096) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const token = body.token;
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const verified = verifyDoneToken(token);
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.error },
        { status: verified.status, headers: NO_STORE_HEADERS }
      );
    }

    const { uid, rid, date: logDate, act } = verified.payload;

    const txResult = await db.transaction(async (tx) => {
      const [settingsRows, routineRows, existingLogRows] = await Promise.all([
        tx
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, uid)),
        tx
          .select()
          .from(routines)
          .where(and(eq(routines.id, rid), eq(routines.userId, uid))),
        tx
          .select()
          .from(routineLogs)
          .where(
            and(
              eq(routineLogs.userId, uid),
              eq(routineLogs.routineId, rid),
              eq(routineLogs.logDate, logDate)
            )
          ),
      ]);

      const s = settingsRows[0];
      const tz = s?.timezone || 'Asia/Kolkata';
      const rollover = s?.dayRolloverHour ?? 4;
      const todayDate = todayLocal(tz, rollover);
      const yesterdayDate = addDays(todayDate, -1);

      const r = routineRows[0];
      const mappedRoutine: Routine | null = r
        ? {
            id: r.id,
            userId: r.userId,
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
          }
        : null;

      const existing = existingLogRows[0];
      const mappedCurrentLog: RoutineLog | null = existing
        ? {
            id: existing.id,
            userId: existing.userId,
            routineId: existing.routineId,
            logDate: existing.logDate,
            status: (existing.status as RoutineLog['status']) || 'partial',
            value: existing.value,
            completedAt: existing.completedAt
              ? existing.completedAt.toISOString()
              : null,
          }
        : null;

      const decision = evaluateDoneAction({
        uid,
        routineId: rid,
        logDate,
        action: act,
        todayDate,
        yesterdayDate,
        routine: mappedRoutine,
        currentLog: mappedCurrentLog,
      });

      if (!decision.ok) {
        return decision;
      }

      if (decision.action !== 'snooze') {
        const nextLog = decision.nextLog;
        const completedAtDate = nextLog.completedAt
          ? new Date(nextLog.completedAt)
          : null;

        await tx
          .insert(routineLogs)
          .values({
            id: nextLog.id,
            userId: uid,
            routineId: rid,
            logDate,
            status: nextLog.status,
            value: nextLog.value,
            completedAt: completedAtDate,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: routineLogs.id,
            set: {
              status: nextLog.status,
              value: nextLog.value,
              completedAt: completedAtDate,
              updatedAt: new Date(),
            },
            setWhere: eq(routineLogs.userId, uid),
          });

        return decision;
      }

      // decision.action === 'snooze'
      const snoozeSentAt = new Date(decision.rescheduledSentAtIso);
      const snoozeKey = decision.snoozeItemKey;
      const routineKey = `routine:${rid}`;
      const waterKeyPrefix = `water:${rid}:%`;

      await tx
        .delete(reminderSent)
        .where(
          and(
            eq(reminderSent.userId, uid),
            eq(reminderSent.logDate, logDate),
            gt(reminderSent.nudgeNo, 0),
            or(
              eq(reminderSent.itemKey, routineKey),
              like(reminderSent.itemKey, waterKeyPrefix)
            )
          )
        );

      // 2. Shift nudge 0 sentAt to (now - 10 min) so the 25-min nudge cooldown triggers in 15 minutes
      await tx
        .update(reminderSent)
        .set({
          sentAt: snoozeSentAt,
        })
        .where(
          and(
            eq(reminderSent.userId, uid),
            eq(reminderSent.logDate, logDate),
            eq(reminderSent.nudgeNo, 0),
            or(
              eq(reminderSent.itemKey, routineKey),
              like(reminderSent.itemKey, waterKeyPrefix)
            )
          )
        );

      // 3. Record a snooze marker in reminder_sent (idempotent on nudge_no = 0)
      await tx
        .insert(reminderSent)
        .values({
          id: `snooze_${crypto.randomUUID()}`,
          userId: uid,
          logDate,
          itemKey: snoozeKey,
          nudgeNo: 0,
          batchId: `snooze_${logDate}`,
          sentAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            reminderSent.userId,
            reminderSent.logDate,
            reminderSent.itemKey,
            reminderSent.nudgeNo,
          ],
          set: {
            sentAt: new Date(),
          },
          setWhere: eq(reminderSent.userId, uid),
        });

      return decision;
    });

    if (!txResult.ok) {
      return NextResponse.json(
        { error: txResult.error },
        { status: txResult.status, headers: NO_STORE_HEADERS }
      );
    }

    if (txResult.action === 'snooze') {
      return NextResponse.json(
        {
          ok: true,
          routineId: rid,
          logDate,
          action: 'snooze',
          snoozeMinutes: txResult.snoozeMinutes,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        routineId: rid,
        logDate,
        action: txResult.action,
        status: txResult.nextLog.status,
        value: txResult.nextLog.value,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[Done Route] Execution failed (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to process reminder action' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
