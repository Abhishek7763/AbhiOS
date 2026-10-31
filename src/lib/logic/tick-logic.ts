import {
  DayPlan,
  ReminderSentRecord,
  Routine,
  RoutineLog,
  UserSettings,
} from '../types';
import {
  computeRoutineDueMinutes,
  isInQuietHours,
  parseTimeMinutes,
} from './dates';
import { applyWaterDelta, filterRoutinesForToday } from './planner';

export interface DueReminderItem {
  itemKey: string;
  title: string;
  body: string;
  nudgeNo: number;
  kind: 'routine' | 'water' | 'duty_prompt' | 'review_prompt';
  routineId?: string;
}

export interface DigestNotificationPayload {
  title: string;
  body: string;
  actions: Array<{ action: 'done' | 'water'; title: string; routineId?: string }>;
  items: DueReminderItem[];
}

export interface TickEvaluationResult {
  skippedQuietHours: boolean;
  skippedCapReached: boolean;
  dueItems: DueReminderItem[];
  digestNotification: DigestNotificationPayload | null;
}

/**
 * Section 10.5: Pure Reminder Engine Tick Logic.
 * - Checks quiet hours
 * - Checks daily batch cap (maxRemindersPerDay)
 * - Evaluates routines (due window: dueMin <= nowMin < dueMin + 90)
 * - Evaluates water checkpoints (nowMin >= checkpoint.at and value < checkpoint.min)
 * - Evaluates duty_prompt and review_prompt
 * - Enforces max 2 nudges per item (nudge 0 initial, nudge 1 if >= 25 min since nudge 0)
 * - Combines due items into a single digest notification
 */
export function evaluateReminderTick(params: {
  todayDate: string;
  nowMin: number;
  nowMs?: number;
  settings: UserSettings;
  dayPlan?: DayPlan | null;
  routines: Routine[];
  routineLogs: RoutineLog[];
  reminderSentToday: ReminderSentRecord[];
  hasDailyReviewToday: boolean;
}): TickEvaluationResult {
  const {
    todayDate,
    nowMin,
    nowMs = Date.now(),
    settings,
    dayPlan,
    routines,
    routineLogs,
    reminderSentToday,
    hasDailyReviewToday,
  } = params;

  // 1. Quiet hours check
  if (isInQuietHours(nowMin, settings.quietStart, settings.quietEnd)) {
    return {
      skippedQuietHours: true,
      skippedCapReached: false,
      dueItems: [],
      digestNotification: null,
    };
  }

  // 2. Daily reminder batch cap check
  const distinctBatches = new Set(reminderSentToday.map((r) => r.batchId));
  if (distinctBatches.size >= settings.maxRemindersPerDay) {
    return {
      skippedQuietHours: false,
      skippedCapReached: true,
      dueItems: [],
      digestNotification: null,
    };
  }

  const logByRoutineId = new Map<string, RoutineLog>();
  for (const log of routineLogs) {
    if (log.logDate === todayDate) {
      logByRoutineId.set(log.routineId, log);
    }
  }

  // Helper to check nudge eligibility (nudge 0 first time; nudge 1 if >= 25m after nudge 0; max 2 nudges)
  const getNextNudgeNo = (itemKey: string): number | null => {
    const sentForKey = reminderSentToday
      .filter((r) => r.itemKey === itemKey)
      .sort((a, b) => a.nudgeNo - b.nudgeNo);

    if (sentForKey.length === 0) return 0;
    if (sentForKey.length >= 2) return null; // Max 2 nudges reached

    const lastSent = sentForKey[sentForKey.length - 1];
    const lastSentMs = new Date(lastSent.sentAt).getTime();
    if (isNaN(lastSentMs)) return null;
    const elapsedMin = (nowMs - lastSentMs) / (1000 * 60);
    if (elapsedMin >= 25) {
      return lastSent.nudgeNo + 1;
    }
    return null;
  };

  const isWithinDueWindow = (dueMin: number): boolean => {
    return nowMin >= dueMin && nowMin < dueMin + 90;
  };

  const dueItems: DueReminderItem[] = [];
  const applicableRoutines = filterRoutinesForToday(routines, todayDate, dayPlan);

  for (const routine of applicableRoutines) {
    const log = logByRoutineId.get(routine.id);

    // Water / checkpoint routine
    if (routine.checkpoints && routine.checkpoints.length > 0) {
      const currentVal = log?.value ?? 0;
      for (const cp of routine.checkpoints) {
        const cpMin = parseTimeMinutes(cp.at);
        if (cpMin === null) continue;
        if (isWithinDueWindow(cpMin) && currentVal < cp.min) {
          const itemKey = `water:${routine.id}:${cp.at}`;
          const nudgeNo = getNextNudgeNo(itemKey);
          if (nudgeNo !== null) {
            dueItems.push({
              itemKey,
              title: `${routine.title} (${currentVal}/${cp.min} ${routine.unit || 'ml'})`,
              body: `${cp.at} checkpoint: ${cp.min} ${routine.unit || 'ml'} target.`,
              nudgeNo,
              kind: 'water',
              routineId: routine.id,
            });
          }
          break; // Only trigger one checkpoint per water routine at a time
        }
      }
      continue;
    }

    // Standard boolean routine
    if (log && (log.status === 'done' || log.status === 'skipped')) {
      continue;
    }

    const dueMin = computeRoutineDueMinutes(routine, settings, dayPlan);
    if (dueMin !== null && isWithinDueWindow(dueMin)) {
      const itemKey = `routine:${routine.id}`;
      const nudgeNo = getNextNudgeNo(itemKey);
      if (nudgeNo !== null) {
        dueItems.push({
          itemKey,
          title: routine.title,
          body:
            nudgeNo === 0
              ? `${routine.title} ka samay ho gaya.`
              : `Reminder: ${routine.title} abhi baaki hai.`,
          nudgeNo,
          kind: 'routine',
          routineId: routine.id,
        });
      }
    }
  }

  // c) duty_prompt: if nowMin >= duty_prompt_time, duty_start is null & !is_off, and any active routine uses duty_start
  const hasDutyAnchoredRoutine = routines.some(
    (r) => r.active && r.anchorType === 'duty_start'
  );
  const dutyPromptMin = parseTimeMinutes(settings.dutyPromptTime);
  if (
    hasDutyAnchoredRoutine &&
    dutyPromptMin !== null &&
    isWithinDueWindow(dutyPromptMin) &&
    (!dayPlan || (!dayPlan.isOff && !dayPlan.dutyStart))
  ) {
    const itemKey = 'duty_prompt';
    const nudgeNo = getNextNudgeNo(itemKey);
    if (nudgeNo !== null) {
      dueItems.push({
        itemKey,
        title: 'Aaj Duty Kitne Baje Hai?',
        body: 'Today screen par Duty time ya Off Day set karein.',
        nudgeNo,
        kind: 'duty_prompt',
      });
    }
  }

  // d) review_prompt: if nowMin >= review_time and no daily review yet
  const reviewPromptMin = parseTimeMinutes(settings.reviewTime);
  if (
    !hasDailyReviewToday &&
    reviewPromptMin !== null &&
    isWithinDueWindow(reviewPromptMin)
  ) {
    const itemKey = 'review_prompt';
    const nudgeNo = getNextNudgeNo(itemKey);
    if (nudgeNo !== null) {
      dueItems.push({
        itemKey,
        title: 'Daily Review (2 Min)',
        body: 'Aaj ke kaam close karein aur kal ka plan halka karein.',
        nudgeNo,
        kind: 'review_prompt',
      });
    }
  }

  if (dueItems.length === 0) {
    return {
      skippedQuietHours: false,
      skippedCapReached: false,
      dueItems: [],
      digestNotification: null,
    };
  }

  // 7. Build single digest notification
  let digestNotification: DigestNotificationPayload;
  if (dueItems.length === 1) {
    const single = dueItems[0];
    const actions: DigestNotificationPayload['actions'] = [];
    if (single.kind === 'routine' && single.routineId) {
      actions.push({
        action: 'done',
        title: 'Ho gaya',
        routineId: single.routineId,
      });
    } else if (single.kind === 'water' && single.routineId) {
      actions.push({
        action: 'water',
        title: '+250 ml',
        routineId: single.routineId,
      });
    }
    digestNotification = {
      title: single.title,
      body: single.body,
      actions,
      items: dueItems,
    };
  } else {
    digestNotification = {
      title: `${dueItems.length} kaam baaki`,
      body: dueItems.map((i) => i.title).join(', '),
      actions: [],
      items: dueItems,
    };
  }

  return {
    skippedQuietHours: false,
    skippedCapReached: false,
    dueItems,
    digestNotification,
  };
}

/**
 * Pure helper: determines if a Web Push error status code indicates an expired/unsubscribed
 * endpoint that must be deleted from push_subscriptions (HTTP 404 Not Found or 410 Gone).
 */
export function shouldCleanupSubscription(statusCode: unknown): boolean {
  return statusCode === 404 || statusCode === 410;
}

/**
 * Pure helper: models ON CONFLICT (user_id, log_date, item_key, nudge_no) DO NOTHING RETURNING
 * idempotency across overlapping or repeated ticks.
 */
export function selectUnrecordedDueItems(
  dueItems: DueReminderItem[],
  existingSentToday: Pick<ReminderSentRecord, 'logDate' | 'itemKey' | 'nudgeNo'>[],
  todayDate: string
): DueReminderItem[] {
  const existingKeys = new Set(
    existingSentToday
      .filter((r) => r.logDate === todayDate)
      .map((r) => `${r.itemKey}#${r.nudgeNo}`)
  );
  return dueItems.filter(
    (item) => !existingKeys.has(`${item.itemKey}#${item.nudgeNo}`)
  );
}

export type PureDoneActionResult =
  | {
      ok: true;
      action: 'done' | 'water';
      nextLog: RoutineLog;
    }
  | {
      ok: true;
      action: 'snooze';
      snoozeMinutes: 15;
      snoozeItemKey: string;
      rescheduledSentAtIso: string;
    }
  | {
      ok: false;
      status: 400 | 403 | 404;
      error: string;
    };

/**
 * Section 10.6 / Step E & F: Pure logic for /api/done route.
 * - Verifies routine exists, belongs to uid, and is active
 * - Accepts only today's logical date or yesterday's
 * - Computes idempotent 'done' or 'water' log update (using applyWaterDelta, capped at targetValue)
 * - Computes 15-minute 'snooze' reschedule timestamp (sets nudge 0 sentAt to now - 10m so the 25m nudge window triggers in 15m)
 */
export function evaluateDoneAction(params: {
  uid: string;
  routineId: string;
  logDate: string;
  action: 'done' | 'water' | 'snooze';
  todayDate: string;
  yesterdayDate: string;
  routine: Routine | null | undefined;
  currentLog: RoutineLog | null | undefined;
  nowMs?: number;
}): PureDoneActionResult {
  const {
    uid,
    routineId,
    logDate,
    action,
    todayDate,
    yesterdayDate,
    routine,
    currentLog,
    nowMs = Date.now(),
  } = params;

  if (logDate !== todayDate && logDate !== yesterdayDate) {
    return {
      ok: false,
      status: 400,
      error: 'Token date is outside the allowed today/yesterday window',
    };
  }

  if (!routine || routine.id !== routineId) {
    return {
      ok: false,
      status: 404,
      error: 'Routine not found',
    };
  }

  if (routine.userId !== uid) {
    return {
      ok: false,
      status: 403,
      error: 'Routine does not belong to user',
    };
  }

  if (!routine.active) {
    return {
      ok: false,
      status: 400,
      error: 'Routine is not active',
    };
  }

  const nowIso = new Date(nowMs).toISOString();

  if (action === 'done') {
    const targetVal = routine.targetValue ?? 1;
    const prevVal = currentLog?.value ?? 0;
    return {
      ok: true,
      action: 'done',
      nextLog: {
        id: currentLog?.id || `${routine.id}_${logDate}`,
        userId: uid,
        routineId: routine.id,
        logDate,
        status: 'done',
        value: Math.max(prevVal, targetVal),
        completedAt: currentLog?.completedAt || nowIso,
      },
    };
  }

  if (action === 'water') {
    const step =
      routine.stepValue && routine.stepValue > 0 ? routine.stepValue : 250;
    const target =
      routine.targetValue && routine.targetValue > 0
        ? routine.targetValue
        : 2500;
    const updated = applyWaterDelta(
      currentLog,
      { id: routine.id, targetValue: target },
      step,
      logDate,
      uid
    );
    const cappedValue = Math.min(target, updated?.value ?? step);
    const isDone = cappedValue >= target;

    return {
      ok: true,
      action: 'water',
      nextLog: {
        id: updated?.id || currentLog?.id || `${routine.id}_${logDate}`,
        userId: uid,
        routineId: routine.id,
        logDate,
        status: isDone ? 'done' : 'partial',
        value: cappedValue,
        completedAt: isDone ? currentLog?.completedAt || nowIso : null,
      },
    };
  }

  // action === 'snooze' (15 min)
  // evaluateReminderTick fires nudge 1 when elapsedMin >= 25.
  // Setting nudge 0 sentAt to (nowMs - 10 min) means (25 - 10) = 15 minutes until next nudge.
  const rescheduledSentAtIso = new Date(nowMs - 10 * 60 * 1000).toISOString();
  return {
    ok: true,
    action: 'snooze',
    snoozeMinutes: 15,
    snoozeItemKey: `snooze:${routine.id}`,
    rescheduledSentAtIso,
  };
}

