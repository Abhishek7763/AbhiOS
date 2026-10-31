import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  computeRoutineDueMinutes,
  daysBetween,
  isInQuietHours,
  isoDow,
  todayLocal,
} from './dates';
import {
  applyWaterDelta,
  computeFocusProgress,
  computeGoalProgressAndNextStep,
  computeLifeBalanceSnapshot,
  computeNextRecurrenceDate,
  computeTodayMomentum,
  DUTY_SHIFT_PRESETS,
  filterRoutinesForToday,
  buildWeeklyDutyRoster,
  computeRoutineInsights,
  formatFocusSeconds,
  generateTwoMinuteStarter,
  normalizeGoalTags,
  searchAllEntities,
  suggestContextualBrainDumpMatch,
  suggestDayTasks,
  suggestIfThenPlan,
  suggestMainPriority,
} from './planner';
import { computeNeedsAttention, shouldShowReEntry } from './attention';
import {
  evaluateGoalCandidateGate,
  validateImportPayload,
} from './quality-gate';
import { evaluateReminderTick } from './tick-logic';
import { Routine, Task, UserSettings } from '../types';

test('todayLocal respects dayRolloverHour at 02:30 IST', () => {
  // 2026-10-30 02:30 IST is 2026-10-29 21:00 UTC
  const nightDutyUtc = new Date('2026-10-29T21:00:00.000Z');
  assert.equal(todayLocal('Asia/Kolkata', 4, nightDutyUtc), '2026-10-29');
  assert.equal(todayLocal('Asia/Kolkata', 2, nightDutyUtc), '2026-10-30');
});

test('isInQuietHours handles midnight wrap (23:00 to 06:00)', () => {
  assert.equal(isInQuietHours(23 * 60 + 15, '23:00', '06:00'), true);
  assert.equal(isInQuietHours(2 * 60, '23:00', '06:00'), true);
  assert.equal(isInQuietHours(6 * 60, '23:00', '06:00'), false);
  assert.equal(isInQuietHours(14 * 60, '23:00', '06:00'), false);
});

test('computeRoutineDueMinutes handles wake and duty_start offsets', () => {
  const settings = { wakeTime: '06:30' };
  const readyForDuty = {
    anchorType: 'duty_start' as const,
    clockTime: null,
    anchorOffsetMin: -90,
  };
  assert.equal(
    computeRoutineDueMinutes(readyForDuty, settings, {
      dutyStart: '08:00',
      isOff: false,
    }),
    6 * 60 + 30 // 08:00 - 90m = 06:30
  );
  assert.equal(
    computeRoutineDueMinutes(readyForDuty, settings, {
      dutyStart: null,
      isOff: false,
    }),
    null
  );
});

test('suggestMainPriority and suggestDayTasks respect urgency, stale rule, and 80% budget', () => {
  const today = '2026-10-30';
  const tasks: Task[] = [
    {
      id: 't-stale',
      userId: 'u1',
      title: '20 days old stale task',
      status: 'todo',
      dueDate: addDays(today, -20),
      estMinutes: 30,
      rescheduleCount: 0,
      createdAt: today,
      updatedAt: today,
    },
    {
      id: 't-today',
      userId: 'u1',
      goalId: 'g-active',
      title: 'Due today active goal task',
      status: 'todo',
      dueDate: today,
      estMinutes: 45,
      rescheduleCount: 0,
      createdAt: today,
      updatedAt: today,
    },
    {
      id: 't-tomorrow',
      userId: 'u1',
      title: 'Due tomorrow task',
      status: 'todo',
      dueDate: addDays(today, 1),
      estMinutes: 40,
      rescheduleCount: 0,
      createdAt: today,
      updatedAt: today,
    },
  ];

  const main = suggestMainPriority(tasks, today, new Set(['g-active']));
  assert.equal(main?.id, 't-today');

  // 100 available minutes => 80m budget. t-today (45m) + t-stale (30m) = 75m (t-tomorrow 40m won't fit 80m)
  const plan = suggestDayTasks(tasks, 100, today, new Set(['g-active']));
  assert.equal(plan.budgetMinutes, 80);
  assert.equal(plan.mainTask?.id, 't-today');
  assert.equal(plan.totalMinutes <= 80, true);
});

test('applyWaterDelta transitions partial -> done -> null on zero', () => {
  const waterRoutine = { id: 'r-water', targetValue: 2500 };
  let log = applyWaterDelta(null, waterRoutine, 250, '2026-10-30', 'u1');
  assert.equal(log?.value, 250);
  assert.equal(log?.status, 'partial');

  log = applyWaterDelta(log, waterRoutine, 2250, '2026-10-30', 'u1');
  assert.equal(log?.value, 2500);
  assert.equal(log?.status, 'done');

  const cleared = applyWaterDelta(log, waterRoutine, -2500, '2026-10-30', 'u1');
  assert.equal(cleared, null);
});

test('computeNeedsAttention separates overdue (<14d) from stale (>=14d) and checks re-entry', () => {
  const today = '2026-10-30';
  const summary = computeNeedsAttention({
    today,
    tasks: [
      {
        id: 't1',
        userId: 'u1',
        title: 'Recent overdue',
        status: 'todo',
        dueDate: addDays(today, -3),
        rescheduleCount: 0,
        createdAt: today,
        updatedAt: today,
      },
      {
        id: 't2',
        userId: 'u1',
        title: 'Stale overdue',
        status: 'todo',
        dueDate: addDays(today, -16),
        rescheduleCount: 4,
        createdAt: today,
        updatedAt: today,
      },
    ],
    inboxItems: [],
    goals: [],
  });

  assert.equal(summary.overdueTasks.length, 1);
  assert.equal(summary.staleTasks.length, 1);
  assert.equal(summary.rescheduleHeavyTasks.length, 1);
  assert.equal(shouldShowReEntry('2026-10-25', today), true);
  assert.equal(shouldShowReEntry('2026-10-28', today), false);
});

test('evaluateGoalCandidateGate enforces required fields and soft active cap', () => {
  const incomplete = evaluateGoalCandidateGate({ title: 'Get Fit' }, 6);
  assert.equal(incomplete.isReadyToAccept, false);
  assert.equal(incomplete.activeGoalCountWarning, true);

  const complete = evaluateGoalCandidateGate(
    {
      title: 'Run 5km comfortably',
      desiredOutcome: '30 minute me bina ruke 5km daudna',
      purposeReason: 'Stamina aur duty ke baad energy banaye rakhne ke liye',
      lifeAreaId: 'area-health',
    },
    3
  );
  assert.equal(complete.isReadyToAccept, true);
  assert.equal(complete.activeGoalCountWarning, false);
});

test('evaluateReminderTick respects quiet hours, checkpoints, and digest batching', () => {
  const settings: UserSettings = {
    userId: 'u1',
    timezone: 'Asia/Kolkata',
    wakeTime: '06:30',
    quietStart: '23:00',
    quietEnd: '06:00',
    dayRolloverHour: 4,
    dailyWorkloadMinutes: 120,
    dutyPromptTime: '06:45',
    reviewTime: '21:30',
    maxRemindersPerDay: 8,
    pushEnabled: true,
  };

  const routines: Routine[] = [
    {
      id: 'r-brush',
      userId: 'u1',
      title: 'Brush & Fresh',
      block: 'morning',
      anchorType: 'wake',
      anchorOffsetMin: 15, // 06:45
      appliesOn: 'all',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isMust: true,
      active: true,
      sortOrder: 1,
    },
    {
      id: 'r-water',
      userId: 'u1',
      title: 'Paani 2.5L',
      block: 'anytime',
      anchorType: 'clock',
      anchorOffsetMin: 0,
      appliesOn: 'all',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isMust: true,
      targetValue: 2500,
      stepValue: 250,
      unit: 'ml',
      checkpoints: [{ at: '11:00', min: 750 }],
      active: true,
      sortOrder: 2,
    },
  ];

  // At 07:00 (420m), Brush (due 06:45 = 405m) is within 90m window
  const res = evaluateReminderTick({
    todayDate: '2026-10-30',
    nowMin: 7 * 60,
    settings,
    dayPlan: {
      id: 'dp1',
      userId: 'u1',
      planDate: '2026-10-30',
      isOff: false,
      dutyStart: '09:00',
      minimumDay: false,
      locked: false,
    },
    routines,
    routineLogs: [],
    reminderSentToday: [],
    hasDailyReviewToday: false,
  });

  assert.equal(res.skippedQuietHours, false);
  assert.equal(res.dueItems.length, 1);
  assert.equal(res.digestNotification?.actions[0]?.action, 'done');
  assert.equal(daysBetween('2026-10-29', '2026-10-30'), 1);
  assert.equal(isoDow('2026-10-30'), 5); // Friday
});

test('validateImportPayload rejects malformed files and accepts valid goal-os exports', () => {
  assert.equal(validateImportPayload(null).ok, false);
  assert.equal(validateImportPayload({ app: 'other' }).ok, false);
  assert.equal(
    validateImportPayload({
      app: 'goal-os',
      version: 2,
      exported_at: new Date().toISOString(),
      tables: {
        lifeAreas: [],
        inboxItems: [],
        goals: [],
        tasks: [],
        routines: [],
      },
    }).ok,
    true
  );
});

test('focus timer helpers, If-Then plan generator, and shift presets work deterministically', () => {
  assert.equal(formatFocusSeconds(1500), '25:00');
  assert.equal(formatFocusSeconds(65), '01:05');
  assert.equal(formatFocusSeconds(0), '00:00');
  assert.equal(computeFocusProgress(750, 1500), 50);
  assert.equal(computeFocusProgress(0, 1500), 100);
  assert.equal(DUTY_SHIFT_PRESETS.length, 5);
  assert.ok(suggestIfThenPlan('Morning Walk', 'Jute pehen kar bahar niklo').includes('Agar duty ke baad'));
});

test('normalizeGoalTags and computeTodayMomentum work accurately', () => {
  assert.deepEqual(normalizeGoalTags('health, #Relationship, finance #health'), [
    '#health',
    '#relationship',
    '#finance',
  ]);
  const mom = computeTodayMomentum({
    todayPendingCount: 2,
    todayCompletedCount: 2,
    routinesDoneCount: 3,
    routinesTotalCount: 4,
  });
  assert.equal(mom.completedUnits, 5);
  assert.equal(mom.totalUnits, 8);
  assert.equal(mom.percent, 63);
});

test('suggestContextualBrainDumpMatch suggests matching category and goal from typed thought', () => {
  const areas = [
    { id: 'area-health', name: 'Health', status: 'active' },
    { id: 'area-finance', name: 'Finance', status: 'active' },
    { id: 'area-relationships', name: 'Relationship', status: 'active' },
  ];
  const goals = [
    {
      id: 'goal-1',
      title: 'Duty ke saath consistent energy aur 2.5L hydration system',
      lifeAreaId: 'area-health',
      status: 'active',
    },
    {
      id: 'goal-2',
      title: '6-Month Emergency Fund (₹50,000 Buffer)',
      lifeAreaId: 'area-finance',
      status: 'active',
    },
  ];

  const financeMatch = suggestContextualBrainDumpMatch(
    'Har mahine ₹5,000 emergency fund me alag rakhna hai',
    areas,
    goals
  );
  assert.equal(financeMatch.suggestedAreaId, 'area-finance');
  assert.equal(financeMatch.suggestedGoalId, 'goal-2');

  const healthMatch = suggestContextualBrainDumpMatch(
    'Subah morning walk aur 2.5L water bottle lena hai',
    areas,
    goals
  );
  assert.equal(healthMatch.suggestedAreaId, 'area-health');
  assert.equal(healthMatch.suggestedGoalId, 'goal-1');
});

test('computeGoalProgressAndNextStep, computeNextRecurrenceDate, generateTwoMinuteStarter, computeLifeBalanceSnapshot, and searchAllEntities work accurately', () => {
  const progress = computeGoalProgressAndNextStep(
    'g1',
    [
      {
        id: 'm1',
        userId: 'u1',
        goalId: 'g1',
        title: 'Step 1',
        status: 'done',
        seq: 1,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'm2',
        userId: 'u1',
        goalId: 'g1',
        title: 'Step 2',
        status: 'todo',
        seq: 2,
        createdAt: '',
        updatedAt: '',
      },
    ],
    [
      {
        id: 't1',
        userId: 'u1',
        goalId: 'g1',
        title: 'Task 1',
        status: 'done',
        rescheduleCount: 0,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 't2',
        userId: 'u1',
        goalId: 'g1',
        title: 'Task 2 Next',
        status: 'todo',
        rescheduleCount: 0,
        createdAt: '',
        updatedAt: '',
      },
    ]
  );
  assert.equal(progress.completedSteps, 2);
  assert.equal(progress.totalSteps, 4);
  assert.equal(progress.percent, 50);
  assert.equal(progress.nextUpTask?.id, 't2');
  assert.equal(progress.nextUpMilestone?.id, 'm2');

  assert.equal(computeNextRecurrenceDate('2026-10-30', 'daily'), '2026-10-31');
  assert.equal(computeNextRecurrenceDate('2026-10-30', 'weekly'), '2026-11-06');
  assert.equal(computeNextRecurrenceDate('2026-10-30', 'monthly'), '2026-11-30');
  assert.equal(computeNextRecurrenceDate('2026-01-31', 'monthly'), '2026-02-28');

  const starter = generateTwoMinuteStarter('Purani almari sort karna');
  assert.equal(starter.length, 2);
  assert.ok(starter[0].includes('2-Min Shuruat'));

  const snapshot = computeLifeBalanceSnapshot(
    [
      { id: 'area-health', userId: 'u1', name: 'Health', status: 'active', sortOrder: 1 },
      { id: 'area-rel', userId: 'u1', name: 'Relationship', status: 'active', sortOrder: 2 },
    ],
    [
      {
        id: 'g1',
        userId: 'u1',
        lifeAreaId: 'area-health',
        title: 'Hydration',
        goalType: 'ongoing_direction',
        status: 'active',
        createdAt: '',
        updatedAt: '',
      },
    ],
    []
  );
  assert.equal(snapshot.items.length, 2);
  assert.ok(snapshot.calmInsight.includes('Relationship'));

  const hits = searchAllEntities('hydration', {
    lifeAreas: [{ id: 'area-health', userId: 'u1', name: 'Health', status: 'active', sortOrder: 1 }],
    inboxItems: [],
    goals: [
      {
        id: 'g1',
        userId: 'u1',
        lifeAreaId: 'area-health',
        title: '2.5L Hydration System',
        goalType: 'ongoing_direction',
        status: 'active',
        createdAt: '',
        updatedAt: '',
      },
    ],
    tasks: [],
    routines: [],
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'goal');
});

test('resolveSqlConnectionMode and resolvePoolMax enforce serverless Cloud SQL pool limits', async () => {
  const { resolveSqlConnectionMode, resolvePoolMax } = await import(
    '../../db/index'
  );

  assert.equal(resolveSqlConnectionMode({}), 'direct');
  assert.equal(
    resolveSqlConnectionMode({
      CLOUD_SQL_INSTANCE_CONNECTION_NAME: 'proj:region:inst',
    }),
    'connector'
  );
  assert.equal(
    resolveSqlConnectionMode({
      SQL_CONNECTION_MODE: 'direct',
      CLOUD_SQL_INSTANCE_CONNECTION_NAME: 'proj:region:inst',
    }),
    'direct'
  );
  assert.equal(
    resolveSqlConnectionMode({ SQL_CONNECTION_MODE: 'connector' }),
    'connector'
  );

  assert.equal(resolvePoolMax({}), 2);
  assert.equal(resolvePoolMax({ SQL_POOL_MAX: '1' }), 1);
  assert.equal(resolvePoolMax({ SQL_POOL_MAX: '2' }), 2);
  assert.equal(resolvePoolMax({ SQL_POOL_MAX: '10' }), 2);
});

test('signDoneToken and verifyDoneToken enforce HMAC-SHA256, expiry, shape validation, and fail-closed secret', async () => {
  const { signDoneToken, verifyDoneToken } = await import('../done-token');

  const secret = '0ab43c5ff75776104b0e75bb3d137b63209dec0e16e010db';
  const now = 1_760_000_000_000;
  const validPayload = {
    uid: 'user-abhi',
    rid: 'rt-water',
    date: '2026-10-31',
    act: 'water' as const,
    exp: now + 60_000,
  };

  // 1. Valid token passes
  const token = signDoneToken(validPayload, secret);
  const verified = verifyDoneToken(token, now, secret);
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.deepEqual(verified.payload, validPayload);
  }

  // 2. Missing secret fails closed
  assert.throws(() => signDoneToken(validPayload, ''), /not configured/);
  const noSecretRes = verifyDoneToken(token, now, '   ');
  assert.equal(noSecretRes.ok, false);
  if (!noSecretRes.ok) {
    assert.equal(noSecretRes.status, 500);
  }

  // 3. Wrong secret fails with 401
  const wrongSecretRes = verifyDoneToken(token, now, 'different-secret-value');
  assert.equal(wrongSecretRes.ok, false);
  if (!wrongSecretRes.ok) {
    assert.equal(wrongSecretRes.status, 401);
  }

  // 4. Expired token fails with 401
  const expiredRes = verifyDoneToken(token, now + 120_000, secret);
  assert.equal(expiredRes.ok, false);
  if (!expiredRes.ok) {
    assert.equal(expiredRes.status, 401);
    assert.match(expiredRes.error, /expired/i);
  }

  // 5. Tampered payload fails with 401
  const decodedJson = JSON.parse(
    Buffer.from(token, 'base64url').toString('utf8')
  );
  decodedJson.act = 'done';
  const tamperedToken = Buffer.from(JSON.stringify(decodedJson)).toString(
    'base64url'
  );
  const tamperedRes = verifyDoneToken(tamperedToken, now, secret);
  assert.equal(tamperedRes.ok, false);
  if (!tamperedRes.ok) {
    assert.equal(tamperedRes.status, 401);
  }

  // 6. Malformed / invalid shape token fails with 400
  const badShapeToken = Buffer.from(
    JSON.stringify({ uid: '', rid: 'rt-1', date: 'bad-date', act: 'done', exp: now, sig: 'a'.repeat(64) })
  ).toString('base64url');
  const badShapeRes = verifyDoneToken(badShapeToken, now, secret);
  assert.equal(badShapeRes.ok, false);
  if (!badShapeRes.ok) {
    assert.equal(badShapeRes.status, 400);
  }
});

test('isEmailAllowed and requireCron enforce fail-closed security rules', async () => {
  const { isEmailAllowed, requireCron } = await import('../auth-server');

  // Fail-closed when ALLOWED_EMAILS is unset or blank
  assert.equal(isEmailAllowed('abhishekbhardwaj7763@gmail.com', ''), false);
  assert.equal(isEmailAllowed('abhishekbhardwaj7763@gmail.com', '   '), false);

  // Allowlisted email matches case-insensitively; unlisted email is rejected
  const envList = 'abhishekbhardwaj7763@gmail.com, backup@example.com';
  assert.equal(
    isEmailAllowed('AbhishekBhardwaj7763@gmail.com', envList),
    true
  );
  assert.equal(isEmailAllowed('backup@example.com', envList), true);
  assert.equal(isEmailAllowed('intruder@gmail.com', envList), false);
  assert.equal(isEmailAllowed(null, envList), false);

  // requireCron fail-closed when CRON_SECRET missing
  const makeReq = (authHeader?: string) => ({
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  });

  const missingSecret = requireCron(makeReq('Bearer test'), '');
  assert.equal(missingSecret.ok, false);
  if (!missingSecret.ok) {
    assert.equal(missingSecret.status, 500);
  }

  const noHeader = requireCron(makeReq(), 'my-cron-secret');
  assert.equal(noHeader.ok, false);
  if (!noHeader.ok) {
    assert.equal(noHeader.status, 401);
  }

  const wrongHeader = requireCron(makeReq('Bearer wrong'), 'my-cron-secret');
  assert.equal(wrongHeader.ok, false);
  if (!wrongHeader.ok) {
    assert.equal(wrongHeader.status, 401);
  }

  const validHeader = requireCron(
    makeReq('Bearer my-cron-secret'),
    'my-cron-secret'
  );
  assert.equal(validHeader.ok, true);
});

test('validateSyncStatePayload and per-user seed IDs protect state integrity and ownership', async () => {
  const { validateSyncStatePayload } = await import('./quality-gate');
  const { createInitialSeedData } = await import('../seed-data');

  const seedA = createInitialSeedData('firebase-uid-user-a');
  const seedB = createInitialSeedData('firebase-uid-user-b');

  // Seed IDs for two distinct authenticated users never collide
  assert.notEqual(seedA.lifeAreas[0].id, seedB.lifeAreas[0].id);
  assert.notEqual(seedA.goals[0].id, seedB.goals[0].id);
  assert.notEqual(seedA.tasks[0].id, seedB.tasks[0].id);
  assert.notEqual(seedA.routines[0].id, seedB.routines[0].id);
  assert.equal(seedA.goals[0].lifeAreaId, seedA.lifeAreas[0].id);

  // Valid seed state passes validateSyncStatePayload
  const validCheck = validateSyncStatePayload(seedA);
  assert.equal(validCheck.ok, true);

  // Invalid enum value is rejected
  const badEnumState = {
    ...seedA,
    tasks: [{ ...seedA.tasks[0], status: 'hacked_status' }],
  };
  const enumCheck = validateSyncStatePayload(badEnumState);
  assert.equal(enumCheck.ok, false);

  // Overlong string is rejected
  const overlongState = {
    ...seedA,
    inboxItems: [{ ...seedA.inboxItems[0], content: 'x'.repeat(6000) }],
  };
  const lenCheck = validateSyncStatePayload(overlongState);
  assert.equal(lenCheck.ok, false);

  // Collection count > 5000 is rejected
  const hugeTasks = Array.from({ length: 5001 }, (_, i) => ({
    id: `t-${i}`,
    title: 'Task',
    status: 'todo',
  }));
  const countCheck = validateSyncStatePayload({
    ...seedA,
    tasks: hugeTasks,
  });
  assert.equal(countCheck.ok, false);
});

test('tick idempotency, quiet hours, daily cap, done-action logic, snooze, and 404/410 cleanup work accurately', async () => {
  const {
    evaluateReminderTick,
    selectUnrecordedDueItems,
    evaluateDoneAction,
    shouldCleanupSubscription,
  } = await import('./tick-logic');
  const { signDoneToken, verifyDoneToken } = await import('../done-token');
  const { createInitialSeedData } = await import('../seed-data');

  const seed = createInitialSeedData('user-rem-1');
  const todayDate = '2026-10-31';
  const yesterdayDate = '2026-10-30';
  const nowMs = Date.parse('2026-10-31T01:30:00.000Z'); // 07:00 IST

  // 1. Tick Idempotency: two runs in the same minute emit only one notification
  const firstRun = evaluateReminderTick({
    todayDate,
    nowMin: 7 * 60, // 07:00 AM
    nowMs,
    settings: seed.settings,
    dayPlan: null,
    routines: seed.routines,
    routineLogs: [],
    reminderSentToday: [],
    hasDailyReviewToday: false,
  });
  assert.ok(firstRun.digestNotification);
  assert.ok(firstRun.dueItems.length > 0);

  const firstInserted = selectUnrecordedDueItems(
    firstRun.dueItems,
    [],
    todayDate
  );
  assert.equal(firstInserted.length, firstRun.dueItems.length);

  // Record sent rows from run 1
  const recordedAfterFirstRun = firstInserted.map((item, idx) => ({
    id: `sent-${idx}`,
    userId: seed.settings.userId,
    logDate: todayDate,
    itemKey: item.itemKey,
    nudgeNo: item.nudgeNo,
    batchId: 'batch-1',
    sentAt: new Date(nowMs).toISOString(),
  }));

  // Overlapping run in the same minute: selectUnrecordedDueItems returns 0 new items
  const overlappingInsert = selectUnrecordedDueItems(
    firstRun.dueItems,
    recordedAfterFirstRun,
    todayDate
  );
  assert.equal(overlappingInsert.length, 0);

  // Sequential run in the same minute with updated reminderSentToday: evaluateReminderTick returns null
  const secondRunSameMin = evaluateReminderTick({
    todayDate,
    nowMin: 7 * 60,
    nowMs: nowMs + 15_000, // 15 seconds later
    settings: seed.settings,
    dayPlan: null,
    routines: seed.routines,
    routineLogs: [],
    reminderSentToday: recordedAfterFirstRun,
    hasDailyReviewToday: false,
  });
  assert.equal(secondRunSameMin.digestNotification, null);
  assert.equal(secondRunSameMin.dueItems.length, 0);

  // 2. Quiet hours -> none
  const quietRun = evaluateReminderTick({
    todayDate,
    nowMin: 23 * 60 + 30, // 23:30 (inside 23:00..06:00)
    nowMs,
    settings: seed.settings,
    dayPlan: null,
    routines: seed.routines,
    routineLogs: [],
    reminderSentToday: [],
    hasDailyReviewToday: false,
  });
  assert.equal(quietRun.skippedQuietHours, true);
  assert.equal(quietRun.digestNotification, null);

  // 3. Daily cap respected
  const cappedSent = Array.from(
    { length: seed.settings.maxRemindersPerDay },
    (_, i) => ({
      id: `cap-${i}`,
      userId: seed.settings.userId,
      logDate: todayDate,
      itemKey: `routine:r-${i}`,
      nudgeNo: 0,
      batchId: `batch-cap-${i}`,
      sentAt: new Date(nowMs).toISOString(),
    })
  );
  const capRun = evaluateReminderTick({
    todayDate,
    nowMin: 7 * 60,
    nowMs,
    settings: seed.settings,
    dayPlan: null,
    routines: seed.routines,
    routineLogs: [],
    reminderSentToday: cappedSent,
    hasDailyReviewToday: false,
  });
  assert.equal(capRun.skippedCapReached, true);
  assert.equal(capRun.digestNotification, null);

  // 4. Done token + evaluateDoneAction ('done', 'water', 'snooze', security checks)
  const boolRoutine = seed.routines.find((r) => !r.targetValue)!;
  const waterRoutine = seed.routines.find((r) => r.targetValue === 2500)!;
  const secret = 'test-done-secret-key-for-unit-tests-1234567890';

  const doneToken = signDoneToken(
    {
      uid: seed.settings.userId,
      rid: boolRoutine.id,
      date: todayDate,
      act: 'done',
      exp: nowMs + 3600_000,
    },
    secret
  );
  const verifiedDone = verifyDoneToken(doneToken, nowMs, secret);
  assert.equal(verifiedDone.ok, true);

  const doneDecision = evaluateDoneAction({
    uid: seed.settings.userId,
    routineId: boolRoutine.id,
    logDate: todayDate,
    action: 'done',
    todayDate,
    yesterdayDate,
    routine: boolRoutine,
    currentLog: null,
    nowMs,
  });
  assert.equal(doneDecision.ok, true);
  if (doneDecision.ok && doneDecision.action === 'done') {
    assert.equal(doneDecision.nextLog.status, 'done');
  }

  // Water action increments by stepValue and caps at targetValue (2500)
  const waterDecision = evaluateDoneAction({
    uid: seed.settings.userId,
    routineId: waterRoutine.id,
    logDate: yesterdayDate, // Yesterday is also allowed
    action: 'water',
    todayDate,
    yesterdayDate,
    routine: waterRoutine,
    currentLog: {
      id: `${waterRoutine.id}_${yesterdayDate}`,
      userId: seed.settings.userId,
      routineId: waterRoutine.id,
      logDate: yesterdayDate,
      status: 'partial',
      value: 2400,
      completedAt: null,
    },
    nowMs,
  });
  assert.equal(waterDecision.ok, true);
  if (waterDecision.ok && waterDecision.action === 'water') {
    assert.equal(waterDecision.nextLog.value, 2500);
    assert.equal(waterDecision.nextLog.status, 'done');
  }

  // Snooze action (15 min) token & evaluation
  const snoozeToken = signDoneToken(
    {
      uid: seed.settings.userId,
      rid: boolRoutine.id,
      date: todayDate,
      act: 'snooze',
      exp: nowMs + 3600_000,
    },
    secret
  );
  const verifiedSnooze = verifyDoneToken(snoozeToken, nowMs, secret);
  assert.equal(verifiedSnooze.ok, true);

  const snoozeDecision = evaluateDoneAction({
    uid: seed.settings.userId,
    routineId: boolRoutine.id,
    logDate: todayDate,
    action: 'snooze',
    todayDate,
    yesterdayDate,
    routine: boolRoutine,
    currentLog: null,
    nowMs,
  });
  assert.equal(snoozeDecision.ok, true);
  if (snoozeDecision.ok && snoozeDecision.action === 'snooze') {
    assert.equal(snoozeDecision.snoozeMinutes, 15);
    // Verify that 15 minutes after snooze, elapsedMin from rescheduledSentAtIso is 25 minutes
    const rescheduledMs = new Date(snoozeDecision.rescheduledSentAtIso).getTime();
    const elapsedAfter15Min = (nowMs + 15 * 60 * 1000 - rescheduledMs) / 60_000;
    assert.equal(elapsedAfter15Min, 25);
  }

  // Rejects date older than yesterday
  const oldDateDecision = evaluateDoneAction({
    uid: seed.settings.userId,
    routineId: boolRoutine.id,
    logDate: '2026-10-25',
    action: 'done',
    todayDate,
    yesterdayDate,
    routine: boolRoutine,
    currentLog: null,
    nowMs,
  });
  assert.equal(oldDateDecision.ok, false);
  if (!oldDateDecision.ok) {
    assert.equal(oldDateDecision.status, 400);
  }

  // Rejects routine owned by another user
  const wrongOwnerDecision = evaluateDoneAction({
    uid: 'different-user',
    routineId: boolRoutine.id,
    logDate: todayDate,
    action: 'done',
    todayDate,
    yesterdayDate,
    routine: boolRoutine,
    currentLog: null,
    nowMs,
  });
  assert.equal(wrongOwnerDecision.ok, false);
  if (!wrongOwnerDecision.ok) {
    assert.equal(wrongOwnerDecision.status, 403);
  }

  // 5. 404 / 410 subscription cleanup logic
  assert.equal(shouldCleanupSubscription(404), true);
  assert.equal(shouldCleanupSubscription(410), true);
  assert.equal(shouldCleanupSubscription(500), false);
  assert.equal(shouldCleanupSubscription(429), false);
  assert.equal(shouldCleanupSubscription(200), false);
  assert.equal(shouldCleanupSubscription(undefined), false);
});

test('Safe Incremental Sync: diff, coalesce, offline edit vs server edit conflict, two devices, and deleted goals never resurrect', async () => {
  const { createInitialSeedData } = await import('../seed-data');
  const {
    coalesceOutboxOps,
    diffStatesToOps,
    isConflictStale,
    mergeServerAndLocalState,
    resolveMutationResults,
    updateDeletedTombstones,
    validateMutatePayload,
  } = await import('./sync');

  const baseState = createInitialSeedData('abhishek-uid');
  const t0 = '2026-10-31T08:00:00.000Z';
  const t1 = '2026-10-31T08:05:00.000Z';
  const t2 = '2026-10-31T08:10:00.000Z';
  const t3 = '2026-10-31T08:15:00.000Z';

  // Normalize base timestamps to t0
  baseState.goals = baseState.goals.map((g) => ({ ...g, updatedAt: t0 }));
  baseState.tasks = baseState.tasks.map((t) => ({ ...t, updatedAt: t0 }));

  const targetGoal = baseState.goals[0]!;
  const secondGoal = baseState.goals[1]!;

  // 1. Create a new task, edit secondGoal, and delete targetGoal
  const newTask: Task = {
    id: 'task-new-sync-1',
    userId: 'abhishek-uid',
    goalId: secondGoal.id,
    title: 'Naya incremental sync task',
    status: 'todo',
    rescheduleCount: 0,
    createdAt: t1,
    updatedAt: t1,
  };

  const editedState = {
    ...baseState,
    goals: baseState.goals
      .filter((g) => g.id !== targetGoal.id)
      .map((g) =>
        g.id === secondGoal.id
          ? { ...g, title: 'Updated Goal Title v1', updatedAt: t1 }
          : g
      ),
    tasks: [newTask, ...baseState.tasks],
  };

  const ops1 = diffStatesToOps(baseState, editedState, t1);
  const deleteGoalOp = ops1.find(
    (o) => o.entity === 'goals' && o.id === targetGoal.id
  );
  assert.ok(deleteGoalOp);
  assert.equal(deleteGoalOp.op, 'delete');

  const editGoalOp = ops1.find(
    (o) => o.entity === 'goals' && o.id === secondGoal.id
  );
  assert.ok(editGoalOp);
  assert.equal(editGoalOp.op, 'upsert');
  assert.equal(editGoalOp.baseUpdatedAt, t0);

  const createTaskOp = ops1.find(
    (o) => o.entity === 'tasks' && o.id === newTask.id
  );
  assert.ok(createTaskOp);
  assert.equal(createTaskOp.op, 'upsert');
  assert.equal(createTaskOp.baseUpdatedAt, undefined);

  // 2. Duplicate / rapid edits on secondGoal coalesce while preserving original baseUpdatedAt (t0)
  const editedState2 = {
    ...editedState,
    goals: editedState.goals.map((g) =>
      g.id === secondGoal.id
        ? { ...g, title: 'Updated Goal Title v2', updatedAt: t2 }
        : g
    ),
  };
  const ops2 = diffStatesToOps(editedState, editedState2, t2);
  const coalesced = coalesceOutboxOps(ops1, ops2);

  const coalescedGoalOps = coalesced.filter(
    (o) => o.entity === 'goals' && o.id === secondGoal.id
  );
  assert.equal(coalescedGoalOps.length, 1);
  assert.equal(coalescedGoalOps[0]!.baseUpdatedAt, t0);
  assert.equal(
    (coalescedGoalOps[0]!.data as { title: string }).title,
    'Updated Goal Title v2'
  );

  // 3. Tombstones record deleted goal so it can never resurrect
  const tombstones = updateDeletedTombstones({}, coalesced);
  assert.equal(Boolean(tombstones[`goals:${targetGoal.id}`]), true);

  // 4. Resurrection of deleted goals MUST NOT happen when merging with server state on login/reload
  // Case A: Delete op is still pending in outbox, server still has targetGoal
  const mergeWhilePendingDelete = mergeServerAndLocalState({
    localState: editedState2,
    serverState: baseState, // server still has targetGoal!
    pendingOutbox: coalesced,
    deletedTombstones: tombstones,
    hasSyncedBefore: false,
    nowIso: t2,
  });
  assert.equal(
    mergeWhilePendingDelete.mergedState.goals.some(
      (g) => g.id === targetGoal.id
    ),
    false,
    'Deleted goal must not be resurrected when delete op is in outbox'
  );
  assert.equal(
    mergeWhilePendingDelete.opsToFlush.some(
      (o) => o.op === 'delete' && o.entity === 'goals' && o.id === targetGoal.id
    ),
    true,
    'Delete op must remain in opsToFlush so server deletes the goal'
  );

  // Case B: Delete op already flushed to server (server no longer has targetGoal), client reloads/logs in
  const serverStateAfterDelete = {
    ...baseState,
    goals: baseState.goals.filter((g) => g.id !== targetGoal.id),
  };
  const mergeAfterServerDelete = mergeServerAndLocalState({
    localState: baseState, // even if local cache had stale seed with targetGoal
    serverState: serverStateAfterDelete,
    pendingOutbox: [],
    deletedTombstones: tombstones,
    hasSyncedBefore: true,
    nowIso: t2,
  });
  assert.equal(
    mergeAfterServerDelete.mergedState.goals.some(
      (g) => g.id === targetGoal.id
    ),
    false,
    'Deleted goal must never be resurrected from local seed after server delete'
  );

  // 5. Two devices / Offline edit then Server edit conflict resolution
  // Device A edited secondGoal based on baseUpdatedAt = t0.
  // Meanwhile Device B updated secondGoal on the server at t3 (t3 > t0).
  assert.equal(isConflictStale(t0, t3), true);
  assert.equal(isConflictStale(t3, t0), false);

  const serverRowFromDeviceB = {
    ...secondGoal,
    title: 'Device B Newer Server Edit',
    updatedAt: t3,
  };

  const resolution = resolveMutationResults({
    currentState: editedState2,
    pendingOutbox: coalesced,
    sentOps: coalesced,
    results: [
      {
        id: targetGoal.id,
        entity: 'goals',
        op: 'delete',
        ok: true,
        updatedAt: t3,
      },
      {
        id: secondGoal.id,
        entity: 'goals',
        op: 'upsert',
        ok: false,
        conflict: true,
        serverRow: serverRowFromDeviceB as unknown as Record<string, unknown>,
        updatedAt: t3,
      },
      {
        id: newTask.id,
        entity: 'tasks',
        op: 'upsert',
        ok: true,
        updatedAt: t3,
      },
    ],
  });

  assert.equal(resolution.conflictCount, 1);
  assert.equal(resolution.remainingOutbox.length, 0);
  const resolvedSecondGoal = resolution.nextState.goals.find(
    (g) => g.id === secondGoal.id
  );
  assert.equal(resolvedSecondGoal?.title, 'Device B Newer Server Edit');
  assert.equal(resolvedSecondGoal?.updatedAt, t3);

  // 6. Validate /api/mutate payload schema & max 200 cap
  const validCheck = validateMutatePayload({ ops: coalesced });
  assert.equal(validCheck.ok, true);

  const emptyCheck = validateMutatePayload({});
  assert.equal(emptyCheck.ok, false);

  const tooManyOps = Array.from({ length: 201 }, (_, i) => ({
    op: 'delete',
    entity: 'tasks',
    id: `task-${i}`,
  }));
  const capCheck = validateMutatePayload({ ops: tooManyOps });
  assert.equal(capCheck.ok, false);
});

test('buildWeeklyDutyRoster builds 7 consecutive days, respects presets/off days, and preserves existing day plan fields', () => {
  const startDate = '2026-10-31';
  const existingPlans = [
    {
      id: 'u1_2026-10-31',
      userId: 'u1',
      planDate: '2026-10-31',
      isOff: false,
      dutyStart: '08:30',
      minimumDay: true,
      mainTaskId: 'task-priority-1',
      locked: false,
    },
  ];

  const entries = [
    { date: '2026-10-31', isOff: false, dutyStart: '08:30' },
    { date: '2026-11-01', isOff: true, dutyStart: '10:00' }, // Off day -> dutyStart should be null
    { date: '2026-11-02', isOff: false, dutyStart: '22:00' }, // Night shift
  ];

  const result = buildWeeklyDutyRoster(startDate, entries, existingPlans, 'u1');

  assert.equal(result.length, 7);
  assert.equal(result[0].planDate, '2026-10-31');
  assert.equal(result[6].planDate, '2026-11-06');

  // Day 0 preserves minimumDay and mainTaskId from existingDayPlans
  assert.equal(result[0].dutyStart, '08:30');
  assert.equal(result[0].isOff, false);
  assert.equal(result[0].minimumDay, true);
  assert.equal(result[0].mainTaskId, 'task-priority-1');

  // Day 1 (Off day): dutyStart is strictly null
  assert.equal(result[1].isOff, true);
  assert.equal(result[1].dutyStart, null);

  // Day 2 (Night shift): dutyStart is '22:00'
  assert.equal(result[2].isOff, false);
  assert.equal(result[2].dutyStart, '22:00');

  // Days 3..6 default safely to dutyStart 08:30 and isOff false
  assert.equal(result[3].isOff, false);
  assert.equal(result[3].dutyStart, '08:30');
});

test('computeRoutineInsights enforces no-guilt, handles off days, inactive routines, minimum-day days, and triggers gentle suggestions when missed >= 5 of 14', () => {
  const today = '2026-10-31';

  const routines: Routine[] = [
    {
      id: 'rt-morning-brush',
      userId: 'u1',
      title: 'Subah Brush & Fresh',
      block: 'morning',
      anchorType: 'wake',
      clockTime: null,
      anchorOffsetMin: 15,
      appliesOn: 'all',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isMust: true,
      targetValue: null,
      stepValue: null,
      unit: null,
      checkpoints: null,
      active: true,
      sortOrder: 0,
      updatedAt: today,
    },
    {
      id: 'rt-duty-ready',
      userId: 'u1',
      title: 'Duty Uniform Ready',
      block: 'duty',
      anchorType: 'duty_start',
      clockTime: null,
      anchorOffsetMin: -60,
      appliesOn: 'duty_days', // Only applies on duty days!
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isMust: false,
      targetValue: null,
      stepValue: null,
      unit: null,
      checkpoints: null,
      active: true,
      sortOrder: 1,
      updatedAt: today,
    },
    {
      id: 'rt-inactive-habit',
      userId: 'u1',
      title: 'Purani Inactive Habit',
      block: 'evening',
      anchorType: 'clock',
      clockTime: '19:00',
      anchorOffsetMin: 0,
      appliesOn: 'all',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isMust: false,
      targetValue: null,
      stepValue: null,
      unit: null,
      checkpoints: null,
      active: false, // Inactive!
      sortOrder: 2,
      updatedAt: today,
    },
    {
      id: 'rt-water',
      userId: 'u1',
      title: 'Paani 2.5L',
      block: 'anytime',
      anchorType: 'clock',
      clockTime: '09:00',
      anchorOffsetMin: 0,
      appliesOn: 'all',
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      isMust: true,
      targetValue: 2500,
      stepValue: 250,
      unit: 'ml',
      checkpoints: null,
      active: true,
      sortOrder: 3,
      updatedAt: today,
    },
  ];

  // 1. Edge Case: Insufficient data (< 3 applicable days)
  const emptyReport = computeRoutineInsights(routines, [], today, 2);
  assert.equal(emptyReport.hasInsights, false);
  assert.equal(emptyReport.insights[0].isInsufficientData, true);
  assert.equal(emptyReport.insights[0].gentleSuggestionKey, null);

  // 2. Setup 14 days of DayPlans where 4 days were Off Days and 2 were Minimum Days
  const dayPlans = [];
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, -i);
    dayPlans.push({
      id: `dp-${d}`,
      userId: 'u1',
      planDate: d,
      isOff: i % 3 === 0, // days 3, 6, 9, 12 are off days
      dutyStart: i % 3 === 0 ? null : '08:30',
      minimumDay: i === 1 || i === 2, // days 1 and 2 are minimum days
      mainTaskId: null,
      locked: false,
    });
  }

  // Setup logs:
  // - rt-morning-brush: completed on 8 days, missed on 6 days -> missed >= 5 should trigger morning_shift_30m
  // - rt-duty-ready: completed on all its applicable duty days -> no suggestion
  // - rt-water: completed on 7 days, missed on 7 days -> triggers water_reduce_step
  const logs = [];
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, -i);
    // Morning brush completed on 8 days (i <= 8)
    if (i <= 8) {
      logs.push({
        id: `l-brush-${d}`,
        userId: 'u1',
        routineId: 'rt-morning-brush',
        logDate: d,
        status: 'done' as const,
        value: 1,
        completedAt: `${d}T07:00:00Z`,
        createdAt: d,
        updatedAt: d,
      });
    }
    // Duty ready completed on all duty days
    if (i % 3 !== 0 && i > 2) {
      logs.push({
        id: `l-duty-${d}`,
        userId: 'u1',
        routineId: 'rt-duty-ready',
        logDate: d,
        status: 'done' as const,
        value: 1,
        completedAt: `${d}T07:30:00Z`,
        createdAt: d,
        updatedAt: d,
      });
    }
    // Water completed on 7 days
    if (i <= 7) {
      logs.push({
        id: `l-water-${d}`,
        userId: 'u1',
        routineId: 'rt-water',
        logDate: d,
        status: 'done' as const,
        value: 2500,
        completedAt: `${d}T20:00:00Z`,
        createdAt: d,
        updatedAt: d,
      });
    }
  }

  const report = computeRoutineInsights(routines, logs, today, 14, dayPlans);

  // Inactive routine is filtered out
  assert.equal(
    report.insights.some((i) => i.routineId === 'rt-inactive-habit'),
    false
  );

  // Check Morning Brush: 14 applicable days, 8 done, 6 missed -> triggers morning_shift_30m
  const morningInsight = report.insights.find(
    (i) => i.routineId === 'rt-morning-brush'
  );
  assert.ok(morningInsight);
  assert.equal(morningInsight.applicableDays, 14);
  assert.equal(morningInsight.doneCount, 8);
  assert.equal(morningInsight.missedCount, 6);
  assert.equal(morningInsight.gentleSuggestionKey, 'morning_shift_30m');

  // Check Duty Ready:
  // Off days (4 days) and Minimum Days (2 days where isMust=false) are NOT applicable!
  // 14 - 4 off days = 10 duty days. Out of 10 duty days, day 1 and 2 were min days,
  // leaving exactly 8 applicable days.
  const dutyInsight = report.insights.find(
    (i) => i.routineId === 'rt-duty-ready'
  );
  assert.ok(dutyInsight);
  assert.equal(dutyInsight.applicableDays, 8);
  assert.equal(dutyInsight.missedCount, 0); // 0 missed!
  assert.equal(dutyInsight.gentleSuggestionKey, null); // No false warnings

  // Check Water: missed >= 5 -> triggers water_reduce_step
  const waterInsight = report.insights.find((i) => i.routineId === 'rt-water');
  assert.ok(waterInsight);
  assert.equal(waterInsight.gentleSuggestionKey, 'water_reduce_step');

  assert.equal(report.hasInsights, true);
  assert.ok(report.calmSummaryText.length > 0);
});





