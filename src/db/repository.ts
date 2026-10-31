import { and, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  aiUsage,
  dailyReviews,
  dayPlans,
  goals,
  inboxItems,
  inboxLinks,
  lifeAreas,
  milestones,
  projects,
  reminderSent,
  routineLogs,
  routines,
  tasks,
  users,
  userSettings,
  weeklyReviews,
} from './schema.ts';
import { AppStateData } from '../lib/types.ts';
import { createInitialSeedData } from '../lib/seed-data.ts';
import {
  isConflictStale,
  MutationOp,
  MutationOpResult,
} from '../lib/logic/sync.ts';

export class OwnershipConflictError extends Error {
  readonly status = 409;
  constructor(entity: string, id: string) {
    super(`Ownership conflict on ${entity} (${id}).`);
    this.name = 'OwnershipConflictError';
  }
}

function assertOwnedUpsert(
  rows: Array<{ id: string }>,
  entity: string,
  id: string
): void {
  if (!rows || rows.length === 0) {
    throw new OwnershipConflictError(entity, id);
  }
}

type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;

async function ensureUserRow(
  executor: DbExecutor,
  uid: string,
  email: string
) {
  const result = await executor
    .insert(users)
    .values({
      uid,
      email: email || 'user@goalos.local',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: email || 'user@goalos.local',
      },
      setWhere: eq(users.uid, uid),
    })
    .returning();

  return result[0];
}

export async function getOrCreateUser(uid: string, email: string) {
  try {
    return await ensureUserRow(db, uid, email);
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

export async function consumeAiDailyQuota(
  uid: string,
  email: string,
  day: string,
  dailyLimit: number
): Promise<{ allowed: boolean; count: number }> {
  await getOrCreateUser(uid, email);

  const existing = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, uid), eq(aiUsage.day, day)));

  const currentCount = existing[0]?.count ?? 0;
  if (currentCount >= dailyLimit) {
    return { allowed: false, count: currentCount };
  }

  const updated = await db
    .insert(aiUsage)
    .values({
      userId: uid,
      day,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        count: sql`${aiUsage.count} + 1`,
      },
      setWhere: eq(aiUsage.userId, uid),
    })
    .returning({ count: aiUsage.count });

  const newCount = updated[0]?.count ?? currentCount + 1;
  return {
    allowed: newCount <= dailyLimit,
    count: newCount,
  };
}

function mapGoalRow(r: typeof goals.$inferSelect, uid: string) {
  return {
    id: r.id,
    userId: uid,
    lifeAreaId: r.lifeAreaId,
    title: r.title,
    desiredOutcome: r.desiredOutcome,
    purposeReason: r.purposeReason,
    ownershipReflection: r.ownershipReflection,
    evidenceOfProgress: r.evidenceOfProgress,
    controlNotes: r.controlNotes,
    tradeoffs: r.tradeoffs,
    capacityNotes: r.capacityNotes,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    goalType: (r.goalType as 'outcome' | 'ongoing_direction') || 'outcome',
    status: r.status as AppStateData['goals'][number]['status'],
    targetDate: r.targetDate,
    reviewDate: r.reviewDate,
    reviewCadence:
      (r.reviewCadence as 'weekly' | 'biweekly' | 'monthly') || 'weekly',
    originInboxItemId: r.originInboxItemId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapTaskRow(r: typeof tasks.$inferSelect, uid: string) {
  return {
    id: r.id,
    userId: uid,
    goalId: r.goalId,
    milestoneId: r.milestoneId,
    projectId: r.projectId,
    parentTaskId: r.parentTaskId,
    originInboxItemId: r.originInboxItemId,
    title: r.title,
    nextAction: r.nextAction,
    status: r.status as AppStateData['tasks'][number]['status'],
    estMinutes: r.estMinutes,
    dueDate: r.dueDate,
    scheduledDate: r.scheduledDate,
    rescheduleCount: r.rescheduleCount,
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapInboxRow(r: typeof inboxItems.$inferSelect, uid: string) {
  return {
    id: r.id,
    userId: uid,
    content: r.content,
    status: r.status as AppStateData['inboxItems'][number]['status'],
    itemType: r.itemType as AppStateData['inboxItems'][number]['itemType'],
    source: (r.source as 'manual' | 'quick_capture' | 'split') || 'manual',
    lifeAreaId: r.lifeAreaId || null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    decisionNote: r.decisionNote,
    linkedEntityType:
      r.linkedEntityType as AppStateData['inboxItems'][number]['linkedEntityType'],
    linkedEntityId: r.linkedEntityId,
    aiSuggestionJson:
      r.aiSuggestionJson as AppStateData['inboxItems'][number]['aiSuggestionJson'],
    processedAt: r.processedAt ? r.processedAt.toISOString() : null,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function getUserFullState(
  uid: string,
  email: string
): Promise<AppStateData> {
  try {
    await getOrCreateUser(uid, email);

    const [
      settingsRows,
      areaRows,
      inboxRows,
      linkRows,
      goalRows,
      projectRows,
      milestoneRows,
      taskRows,
      dayPlanRows,
      routineRows,
      logRows,
      dailyRevRows,
      weeklyRevRows,
      remSentRows,
    ] = await Promise.all([
      db.select().from(userSettings).where(eq(userSettings.userId, uid)),
      db.select().from(lifeAreas).where(eq(lifeAreas.userId, uid)),
      db.select().from(inboxItems).where(eq(inboxItems.userId, uid)),
      db.select().from(inboxLinks).where(eq(inboxLinks.userId, uid)),
      db.select().from(goals).where(eq(goals.userId, uid)),
      db.select().from(projects).where(eq(projects.userId, uid)),
      db.select().from(milestones).where(eq(milestones.userId, uid)),
      db.select().from(tasks).where(eq(tasks.userId, uid)),
      db.select().from(dayPlans).where(eq(dayPlans.userId, uid)),
      db.select().from(routines).where(eq(routines.userId, uid)),
      db.select().from(routineLogs).where(eq(routineLogs.userId, uid)),
      db.select().from(dailyReviews).where(eq(dailyReviews.userId, uid)),
      db.select().from(weeklyReviews).where(eq(weeklyReviews.userId, uid)),
      db.select().from(reminderSent).where(eq(reminderSent.userId, uid)),
    ]);

    // First-time user: seed initial starter setup in PostgreSQL only when settings row does not exist yet
    if (!settingsRows[0] && areaRows.length === 0 && routineRows.length === 0) {
      const seed = createInitialSeedData(uid);
      await saveUserFullState(uid, email, seed);
      return seed;
    }

    const defaultSeed = createInitialSeedData(uid);
    const s = settingsRows[0];

    return {
      settings: s
        ? {
            userId: uid,
            timezone: s.timezone,
            wakeTime: s.wakeTime,
            quietStart: s.quietStart,
            quietEnd: s.quietEnd,
            dayRolloverHour: s.dayRolloverHour,
            dailyWorkloadMinutes: s.dailyWorkloadMinutes,
            dutyPromptTime: s.dutyPromptTime,
            reviewTime: s.reviewTime,
            maxRemindersPerDay: s.maxRemindersPerDay,
            pushEnabled: s.pushEnabled,
            lastActiveDate: s.lastActiveDate,
          }
        : defaultSeed.settings,
      lifeAreas: areaRows.map((r) => ({
        id: r.id,
        userId: uid,
        name: r.name,
        description: r.description,
        status: (r.status as 'active' | 'archived') || 'active',
        sortOrder: r.sortOrder,
        updatedAt: r.updatedAt.toISOString(),
      })),
      inboxItems: inboxRows.map((r) => mapInboxRow(r, uid)),
      inboxLinks: linkRows.map((r) => ({
        id: r.id,
        userId: uid,
        inboxItemId: r.inboxItemId,
        targetType: r.targetType as AppStateData['inboxLinks'][number]['targetType'],
        targetId: r.targetId,
        createdAt: r.createdAt.toISOString(),
      })),
      goals: goalRows.map((r) => mapGoalRow(r, uid)),
      projects: projectRows.map((r) => ({
        id: r.id,
        userId: uid,
        goalId: r.goalId,
        lifeAreaId: r.lifeAreaId,
        title: r.title,
        description: r.description,
        status: r.status as AppStateData['projects'][number]['status'],
        originInboxItemId: r.originInboxItemId,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      milestones: milestoneRows.map((r) => ({
        id: r.id,
        userId: uid,
        goalId: r.goalId,
        title: r.title,
        description: r.description,
        status: r.status as AppStateData['milestones'][number]['status'],
        seq: r.seq,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      tasks: taskRows.map((r) => mapTaskRow(r, uid)),
      dayPlans: dayPlanRows.map((r) => ({
        id: r.id,
        userId: uid,
        planDate: r.planDate,
        isOff: r.isOff,
        dutyStart: r.dutyStart,
        minimumDay: r.minimumDay,
        mainTaskId: r.mainTaskId,
        locked: r.locked,
        updatedAt: r.updatedAt.toISOString(),
      })),
      routines: routineRows.map((r) => ({
        id: r.id,
        userId: uid,
        goalId: r.goalId,
        originInboxItemId: r.originInboxItemId,
        title: r.title,
        block: r.block as AppStateData['routines'][number]['block'],
        anchorType:
          r.anchorType as AppStateData['routines'][number]['anchorType'],
        clockTime: r.clockTime,
        anchorOffsetMin: r.anchorOffsetMin,
        appliesOn: r.appliesOn as AppStateData['routines'][number]['appliesOn'],
        daysOfWeek: Array.isArray(r.daysOfWeek)
          ? (r.daysOfWeek as number[])
          : [1, 2, 3, 4, 5, 6, 7],
        isMust: r.isMust,
        targetValue: r.targetValue,
        stepValue: r.stepValue,
        unit: r.unit,
        checkpoints:
          (r.checkpoints as AppStateData['routines'][number]['checkpoints']) ||
          null,
        active: r.active,
        sortOrder: r.sortOrder,
        updatedAt: r.updatedAt.toISOString(),
      })),
      routineLogs: logRows.map((r) => ({
        id: r.id,
        userId: uid,
        routineId: r.routineId,
        logDate: r.logDate,
        status: r.status as AppStateData['routineLogs'][number]['status'],
        value: r.value,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        updatedAt: r.updatedAt.toISOString(),
      })),
      dailyReviews: dailyRevRows.map((r) => ({
        id: r.id,
        userId: uid,
        reviewDate: r.reviewDate,
        completedText: r.completedText,
        pendingText: r.pendingText,
        surpriseText: r.surpriseText,
        changeTomorrow: r.changeTomorrow,
        updatedAt: r.updatedAt.toISOString(),
      })),
      weeklyReviews: weeklyRevRows.map((r) => ({
        id: r.id,
        userId: uid,
        weekStart: r.weekStart,
        accomplishments: r.accomplishments,
        challenges: r.challenges,
        decisions: r.decisions,
        nextPriorities: r.nextPriorities,
        updatedAt: r.updatedAt.toISOString(),
      })),
      reminderSent: remSentRows.map((r) => ({
        id: r.id,
        userId: uid,
        logDate: r.logDate,
        itemKey: r.itemKey,
        nudgeNo: r.nudgeNo,
        batchId: r.batchId,
        sentAt: r.sentAt.toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof OwnershipConflictError) {
      throw error;
    }
    console.error('Database getUserFullState failed:', error);
    throw new Error('Database query failed. Please try again later.', {
      cause: error,
    });
  }
}

/**
 * Atomic full-state save / import wrapped inside a SINGLE db.transaction.
 * If options.replace is true (used for atomic import 'replace' / 'replace-empty' mode),
 * clears all existing user-scoped rows inside the transaction before inserting.
 */
export async function saveUserFullState(
  uid: string,
  email: string,
  state: AppStateData,
  options?: { replace?: boolean }
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await ensureUserRow(tx, uid, email);

      if (options?.replace) {
        await tx.delete(routineLogs).where(eq(routineLogs.userId, uid));
        await tx.delete(routines).where(eq(routines.userId, uid));
        await tx.delete(dayPlans).where(eq(dayPlans.userId, uid));
        await tx.delete(tasks).where(eq(tasks.userId, uid));
        await tx.delete(milestones).where(eq(milestones.userId, uid));
        await tx.delete(projects).where(eq(projects.userId, uid));
        await tx.delete(goals).where(eq(goals.userId, uid));
        await tx.delete(inboxLinks).where(eq(inboxLinks.userId, uid));
        await tx.delete(inboxItems).where(eq(inboxItems.userId, uid));
        await tx.delete(lifeAreas).where(eq(lifeAreas.userId, uid));
        await tx.delete(dailyReviews).where(eq(dailyReviews.userId, uid));
        await tx.delete(weeklyReviews).where(eq(weeklyReviews.userId, uid));
      }

      if (state.settings) {
        const settingsRes = await tx
          .insert(userSettings)
          .values({
            userId: uid,
            timezone: state.settings.timezone || 'Asia/Kolkata',
            wakeTime: state.settings.wakeTime || '06:30',
            quietStart: state.settings.quietStart || '23:00',
            quietEnd: state.settings.quietEnd || '06:00',
            dayRolloverHour: state.settings.dayRolloverHour ?? 4,
            dailyWorkloadMinutes: state.settings.dailyWorkloadMinutes ?? 120,
            dutyPromptTime: state.settings.dutyPromptTime || '06:45',
            reviewTime: state.settings.reviewTime || '21:30',
            maxRemindersPerDay: state.settings.maxRemindersPerDay ?? 8,
            pushEnabled: state.settings.pushEnabled ?? true,
            lastActiveDate: state.settings.lastActiveDate || null,
          })
          .onConflictDoUpdate({
            target: userSettings.userId,
            set: {
              timezone: state.settings.timezone || 'Asia/Kolkata',
              wakeTime: state.settings.wakeTime || '06:30',
              quietStart: state.settings.quietStart || '23:00',
              quietEnd: state.settings.quietEnd || '06:00',
              dayRolloverHour: state.settings.dayRolloverHour ?? 4,
              dailyWorkloadMinutes: state.settings.dailyWorkloadMinutes ?? 120,
              dutyPromptTime: state.settings.dutyPromptTime || '06:45',
              reviewTime: state.settings.reviewTime || '21:30',
              maxRemindersPerDay: state.settings.maxRemindersPerDay ?? 8,
              pushEnabled: state.settings.pushEnabled ?? true,
              lastActiveDate: state.settings.lastActiveDate || null,
              updatedAt: new Date(),
            },
            setWhere: eq(userSettings.userId, uid),
          })
          .returning({ id: userSettings.userId });
        assertOwnedUpsert(settingsRes, 'user_settings', uid);
      }

      for (const area of state.lifeAreas || []) {
        const res = await tx
          .insert(lifeAreas)
          .values({
            id: area.id,
            userId: uid,
            name: area.name,
            description: area.description || null,
            status: area.status || 'active',
            sortOrder: area.sortOrder ?? 0,
          })
          .onConflictDoUpdate({
            target: lifeAreas.id,
            set: {
              name: area.name,
              description: area.description || null,
              status: area.status || 'active',
              sortOrder: area.sortOrder ?? 0,
              updatedAt: new Date(),
            },
            setWhere: eq(lifeAreas.userId, uid),
          })
          .returning({ id: lifeAreas.id });
        assertOwnedUpsert(res, 'life_areas', area.id);
      }

      for (const item of state.inboxItems || []) {
        const res = await tx
          .insert(inboxItems)
          .values({
            id: item.id,
            userId: uid,
            content: item.content,
            status: item.status || 'new',
            itemType: item.itemType || 'unknown',
            source: item.source || 'manual',
            lifeAreaId: item.lifeAreaId || null,
            tags: Array.isArray(item.tags) ? item.tags : [],
            decisionNote: item.decisionNote || null,
            linkedEntityType: item.linkedEntityType || null,
            linkedEntityId: item.linkedEntityId || null,
            aiSuggestionJson: item.aiSuggestionJson || null,
            processedAt: item.processedAt ? new Date(item.processedAt) : null,
            archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
          })
          .onConflictDoUpdate({
            target: inboxItems.id,
            set: {
              content: item.content,
              status: item.status || 'new',
              itemType: item.itemType || 'unknown',
              lifeAreaId: item.lifeAreaId || null,
              tags: Array.isArray(item.tags) ? item.tags : [],
              decisionNote: item.decisionNote || null,
              linkedEntityType: item.linkedEntityType || null,
              linkedEntityId: item.linkedEntityId || null,
              aiSuggestionJson: item.aiSuggestionJson || null,
              processedAt: item.processedAt ? new Date(item.processedAt) : null,
              archivedAt: item.archivedAt ? new Date(item.archivedAt) : null,
              updatedAt: new Date(),
            },
            setWhere: eq(inboxItems.userId, uid),
          })
          .returning({ id: inboxItems.id });
        assertOwnedUpsert(res, 'inbox_items', item.id);
      }

      for (const link of state.inboxLinks || []) {
        const res = await tx
          .insert(inboxLinks)
          .values({
            id: link.id,
            userId: uid,
            inboxItemId: link.inboxItemId,
            targetType: link.targetType,
            targetId: link.targetId,
          })
          .onConflictDoUpdate({
            target: inboxLinks.id,
            set: {
              inboxItemId: link.inboxItemId,
              targetType: link.targetType,
              targetId: link.targetId,
            },
            setWhere: eq(inboxLinks.userId, uid),
          })
          .returning({ id: inboxLinks.id });
        assertOwnedUpsert(res, 'inbox_links', link.id);
      }

      for (const goal of state.goals || []) {
        const res = await tx
          .insert(goals)
          .values({
            id: goal.id,
            userId: uid,
            lifeAreaId: goal.lifeAreaId,
            title: goal.title,
            desiredOutcome: goal.desiredOutcome || null,
            purposeReason: goal.purposeReason || null,
            ownershipReflection: goal.ownershipReflection || null,
            evidenceOfProgress: goal.evidenceOfProgress || null,
            controlNotes: goal.controlNotes || null,
            tradeoffs: goal.tradeoffs || null,
            capacityNotes: goal.capacityNotes || null,
            tags: Array.isArray(goal.tags) ? goal.tags : [],
            goalType: goal.goalType || 'outcome',
            status: goal.status || 'candidate',
            targetDate: goal.targetDate || null,
            reviewDate: goal.reviewDate || null,
            reviewCadence: goal.reviewCadence || 'weekly',
            originInboxItemId: goal.originInboxItemId || null,
          })
          .onConflictDoUpdate({
            target: goals.id,
            set: {
              lifeAreaId: goal.lifeAreaId,
              title: goal.title,
              desiredOutcome: goal.desiredOutcome || null,
              purposeReason: goal.purposeReason || null,
              ownershipReflection: goal.ownershipReflection || null,
              evidenceOfProgress: goal.evidenceOfProgress || null,
              controlNotes: goal.controlNotes || null,
              tradeoffs: goal.tradeoffs || null,
              capacityNotes: goal.capacityNotes || null,
              tags: Array.isArray(goal.tags) ? goal.tags : [],
              goalType: goal.goalType || 'outcome',
              status: goal.status || 'candidate',
              targetDate: goal.targetDate || null,
              reviewDate: goal.reviewDate || null,
              reviewCadence: goal.reviewCadence || 'weekly',
              updatedAt: new Date(),
            },
            setWhere: eq(goals.userId, uid),
          })
          .returning({ id: goals.id });
        assertOwnedUpsert(res, 'goals', goal.id);
      }

      for (const proj of state.projects || []) {
        const res = await tx
          .insert(projects)
          .values({
            id: proj.id,
            userId: uid,
            goalId: proj.goalId || null,
            lifeAreaId: proj.lifeAreaId || null,
            title: proj.title,
            description: proj.description || null,
            status: proj.status || 'active',
            originInboxItemId: proj.originInboxItemId || null,
          })
          .onConflictDoUpdate({
            target: projects.id,
            set: {
              goalId: proj.goalId || null,
              lifeAreaId: proj.lifeAreaId || null,
              title: proj.title,
              description: proj.description || null,
              status: proj.status || 'active',
              updatedAt: new Date(),
            },
            setWhere: eq(projects.userId, uid),
          })
          .returning({ id: projects.id });
        assertOwnedUpsert(res, 'projects', proj.id);
      }

      for (const ms of state.milestones || []) {
        const res = await tx
          .insert(milestones)
          .values({
            id: ms.id,
            userId: uid,
            goalId: ms.goalId,
            title: ms.title,
            description: ms.description || null,
            status: ms.status || 'todo',
            seq: ms.seq ?? 0,
          })
          .onConflictDoUpdate({
            target: milestones.id,
            set: {
              title: ms.title,
              description: ms.description || null,
              status: ms.status || 'todo',
              seq: ms.seq ?? 0,
              updatedAt: new Date(),
            },
            setWhere: eq(milestones.userId, uid),
          })
          .returning({ id: milestones.id });
        assertOwnedUpsert(res, 'milestones', ms.id);
      }

      for (const task of state.tasks || []) {
        const res = await tx
          .insert(tasks)
          .values({
            id: task.id,
            userId: uid,
            goalId: task.goalId || null,
            milestoneId: task.milestoneId || null,
            projectId: task.projectId || null,
            parentTaskId: task.parentTaskId || null,
            originInboxItemId: task.originInboxItemId || null,
            title: task.title,
            nextAction: task.nextAction || null,
            status: task.status || 'todo',
            estMinutes: task.estMinutes ?? null,
            dueDate: task.dueDate || null,
            scheduledDate: task.scheduledDate || null,
            rescheduleCount: task.rescheduleCount ?? 0,
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
          })
          .onConflictDoUpdate({
            target: tasks.id,
            set: {
              goalId: task.goalId || null,
              milestoneId: task.milestoneId || null,
              projectId: task.projectId || null,
              title: task.title,
              nextAction: task.nextAction || null,
              status: task.status || 'todo',
              estMinutes: task.estMinutes ?? null,
              dueDate: task.dueDate || null,
              scheduledDate: task.scheduledDate || null,
              rescheduleCount: task.rescheduleCount ?? 0,
              completedAt: task.completedAt ? new Date(task.completedAt) : null,
              updatedAt: new Date(),
            },
            setWhere: eq(tasks.userId, uid),
          })
          .returning({ id: tasks.id });
        assertOwnedUpsert(res, 'tasks', task.id);
      }

      for (const dp of state.dayPlans || []) {
        const dpId = dp.id || `${uid}_${dp.planDate}`;
        const res = await tx
          .insert(dayPlans)
          .values({
            id: dpId,
            userId: uid,
            planDate: dp.planDate,
            isOff: dp.isOff ?? false,
            dutyStart: dp.dutyStart || null,
            minimumDay: dp.minimumDay ?? false,
            mainTaskId: dp.mainTaskId || null,
            locked: dp.locked ?? false,
          })
          .onConflictDoUpdate({
            target: dayPlans.id,
            set: {
              isOff: dp.isOff ?? false,
              dutyStart: dp.dutyStart || null,
              minimumDay: dp.minimumDay ?? false,
              mainTaskId: dp.mainTaskId || null,
              locked: dp.locked ?? false,
              updatedAt: new Date(),
            },
            setWhere: eq(dayPlans.userId, uid),
          })
          .returning({ id: dayPlans.id });
        assertOwnedUpsert(res, 'day_plans', dpId);
      }

      for (const rt of state.routines || []) {
        const res = await tx
          .insert(routines)
          .values({
            id: rt.id,
            userId: uid,
            goalId: rt.goalId || null,
            originInboxItemId: rt.originInboxItemId || null,
            title: rt.title,
            block: rt.block || 'anytime',
            anchorType: rt.anchorType || 'clock',
            clockTime: rt.clockTime || null,
            anchorOffsetMin: rt.anchorOffsetMin ?? 0,
            appliesOn: rt.appliesOn || 'all',
            daysOfWeek: rt.daysOfWeek || [1, 2, 3, 4, 5, 6, 7],
            isMust: rt.isMust ?? false,
            targetValue: rt.targetValue ?? null,
            stepValue: rt.stepValue ?? null,
            unit: rt.unit || null,
            checkpoints: rt.checkpoints || null,
            active: rt.active ?? true,
            sortOrder: rt.sortOrder ?? 0,
          })
          .onConflictDoUpdate({
            target: routines.id,
            set: {
              title: rt.title,
              block: rt.block || 'anytime',
              anchorType: rt.anchorType || 'clock',
              clockTime: rt.clockTime || null,
              anchorOffsetMin: rt.anchorOffsetMin ?? 0,
              appliesOn: rt.appliesOn || 'all',
              daysOfWeek: rt.daysOfWeek || [1, 2, 3, 4, 5, 6, 7],
              isMust: rt.isMust ?? false,
              targetValue: rt.targetValue ?? null,
              stepValue: rt.stepValue ?? null,
              unit: rt.unit || null,
              checkpoints: rt.checkpoints || null,
              active: rt.active ?? true,
              sortOrder: rt.sortOrder ?? 0,
              updatedAt: new Date(),
            },
            setWhere: eq(routines.userId, uid),
          })
          .returning({ id: routines.id });
        assertOwnedUpsert(res, 'routines', rt.id);
      }

      // Inside the same transaction: replace user's routine logs cleanly
      await tx.delete(routineLogs).where(eq(routineLogs.userId, uid));
      for (const log of state.routineLogs || []) {
        if (log.value <= 0 && log.status !== 'done' && log.status !== 'skipped') {
          continue;
        }
        const logId = log.id || `${log.routineId}_${log.logDate}`;
        const res = await tx
          .insert(routineLogs)
          .values({
            id: logId,
            userId: uid,
            routineId: log.routineId,
            logDate: log.logDate,
            status: log.status,
            value: log.value ?? 0,
            completedAt: log.completedAt ? new Date(log.completedAt) : null,
          })
          .onConflictDoUpdate({
            target: routineLogs.id,
            set: {
              status: log.status,
              value: log.value ?? 0,
              completedAt: log.completedAt ? new Date(log.completedAt) : null,
              updatedAt: new Date(),
            },
            setWhere: eq(routineLogs.userId, uid),
          })
          .returning({ id: routineLogs.id });
        assertOwnedUpsert(res, 'routine_logs', logId);
      }

      for (const dr of state.dailyReviews || []) {
        const drId = dr.id || `${uid}_${dr.reviewDate}`;
        const res = await tx
          .insert(dailyReviews)
          .values({
            id: drId,
            userId: uid,
            reviewDate: dr.reviewDate,
            completedText: dr.completedText || null,
            pendingText: dr.pendingText || null,
            surpriseText: dr.surpriseText || null,
            changeTomorrow: dr.changeTomorrow || null,
          })
          .onConflictDoUpdate({
            target: dailyReviews.id,
            set: {
              completedText: dr.completedText || null,
              pendingText: dr.pendingText || null,
              surpriseText: dr.surpriseText || null,
              changeTomorrow: dr.changeTomorrow || null,
              updatedAt: new Date(),
            },
            setWhere: eq(dailyReviews.userId, uid),
          })
          .returning({ id: dailyReviews.id });
        assertOwnedUpsert(res, 'daily_reviews', drId);
      }

      for (const wr of state.weeklyReviews || []) {
        const wrId = wr.id || `${uid}_${wr.weekStart}`;
        const res = await tx
          .insert(weeklyReviews)
          .values({
            id: wrId,
            userId: uid,
            weekStart: wr.weekStart,
            accomplishments: wr.accomplishments || null,
            challenges: wr.challenges || null,
            decisions: wr.decisions || null,
            nextPriorities: wr.nextPriorities || null,
          })
          .onConflictDoUpdate({
            target: weeklyReviews.id,
            set: {
              accomplishments: wr.accomplishments || null,
              challenges: wr.challenges || null,
              decisions: wr.decisions || null,
              nextPriorities: wr.nextPriorities || null,
              updatedAt: new Date(),
            },
            setWhere: eq(weeklyReviews.userId, uid),
          })
          .returning({ id: weeklyReviews.id });
        assertOwnedUpsert(res, 'weekly_reviews', wrId);
      }
    });
  } catch (error) {
    if (error instanceof OwnershipConflictError) {
      throw error;
    }
    console.error('Database saveUserFullState failed:', error);
    throw new Error('Database save failed. Please try again later.', {
      cause: error,
    });
  }
}

/**
 * Incremental mutation executor for POST /api/mutate.
 * Executes all ops (max 200) inside a SINGLE db.transaction.
 * - For 'upsert': checks baseUpdatedAt against existing server row's updated_at;
 *   if baseUpdatedAt is older, returns { conflict: true, serverRow } without overwriting.
 * - For 'delete': performs a real user-scoped SQL DELETE and cleans up child references
 *   inside the same transaction so deleted rows never resurrect.
 */
export async function applyUserMutationOps(
  uid: string,
  email: string,
  ops: MutationOp[]
): Promise<MutationOpResult[]> {
  return await db.transaction(async (tx) => {
    await ensureUserRow(tx, uid, email);
    const results: MutationOpResult[] = [];

    for (const op of ops) {
      const now = new Date();
      const nowIso = now.toISOString();

      if (op.op === 'delete') {
        switch (op.entity) {
          case 'lifeAreas':
            await tx
              .delete(lifeAreas)
              .where(and(eq(lifeAreas.id, op.id), eq(lifeAreas.userId, uid)));
            break;
          case 'inboxItems':
            await tx
              .delete(inboxLinks)
              .where(
                and(
                  eq(inboxLinks.inboxItemId, op.id),
                  eq(inboxLinks.userId, uid)
                )
              );
            await tx
              .delete(inboxItems)
              .where(and(eq(inboxItems.id, op.id), eq(inboxItems.userId, uid)));
            break;
          case 'inboxLinks':
            await tx
              .delete(inboxLinks)
              .where(and(eq(inboxLinks.id, op.id), eq(inboxLinks.userId, uid)));
            break;
          case 'goals':
            // Clean up child references inside the same transaction
            await tx
              .delete(milestones)
              .where(
                and(eq(milestones.goalId, op.id), eq(milestones.userId, uid))
              );
            await tx
              .update(tasks)
              .set({ goalId: null, milestoneId: null, updatedAt: now })
              .where(and(eq(tasks.goalId, op.id), eq(tasks.userId, uid)));
            await tx
              .update(projects)
              .set({ goalId: null, updatedAt: now })
              .where(and(eq(projects.goalId, op.id), eq(projects.userId, uid)));
            await tx
              .update(routines)
              .set({ goalId: null, updatedAt: now })
              .where(and(eq(routines.goalId, op.id), eq(routines.userId, uid)));
            await tx
              .delete(goals)
              .where(and(eq(goals.id, op.id), eq(goals.userId, uid)));
            break;
          case 'projects':
            await tx
              .update(tasks)
              .set({ projectId: null, updatedAt: now })
              .where(and(eq(tasks.projectId, op.id), eq(tasks.userId, uid)));
            await tx
              .delete(projects)
              .where(and(eq(projects.id, op.id), eq(projects.userId, uid)));
            break;
          case 'milestones':
            await tx
              .update(tasks)
              .set({ milestoneId: null, updatedAt: now })
              .where(and(eq(tasks.milestoneId, op.id), eq(tasks.userId, uid)));
            await tx
              .delete(milestones)
              .where(and(eq(milestones.id, op.id), eq(milestones.userId, uid)));
            break;
          case 'tasks':
            await tx
              .delete(tasks)
              .where(and(eq(tasks.id, op.id), eq(tasks.userId, uid)));
            break;
          case 'dayPlans':
            await tx
              .delete(dayPlans)
              .where(and(eq(dayPlans.id, op.id), eq(dayPlans.userId, uid)));
            break;
          case 'routines':
            await tx
              .delete(routineLogs)
              .where(
                and(
                  eq(routineLogs.routineId, op.id),
                  eq(routineLogs.userId, uid)
                )
              );
            await tx
              .delete(routines)
              .where(and(eq(routines.id, op.id), eq(routines.userId, uid)));
            break;
          case 'routineLogs':
            await tx
              .delete(routineLogs)
              .where(
                and(eq(routineLogs.id, op.id), eq(routineLogs.userId, uid))
              );
            break;
          case 'dailyReviews':
            await tx
              .delete(dailyReviews)
              .where(
                and(eq(dailyReviews.id, op.id), eq(dailyReviews.userId, uid))
              );
            break;
          case 'weeklyReviews':
            await tx
              .delete(weeklyReviews)
              .where(
                and(eq(weeklyReviews.id, op.id), eq(weeklyReviews.userId, uid))
              );
            break;
          default:
            break;
        }

        results.push({
          id: op.id,
          entity: op.entity,
          op: 'delete',
          ok: true,
          updatedAt: nowIso,
        });
        continue;
      }

      // op.op === 'upsert'
      const d = (op.data || {}) as Record<string, unknown>;

      switch (op.entity) {
        case 'settings': {
          const existing = (
            await tx
              .select()
              .from(userSettings)
              .where(eq(userSettings.userId, uid))
          )[0];

          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'settings',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                userId: uid,
                timezone: existing.timezone,
                wakeTime: existing.wakeTime,
                quietStart: existing.quietStart,
                quietEnd: existing.quietEnd,
                dayRolloverHour: existing.dayRolloverHour,
                dailyWorkloadMinutes: existing.dailyWorkloadMinutes,
                dutyPromptTime: existing.dutyPromptTime,
                reviewTime: existing.reviewTime,
                maxRemindersPerDay: existing.maxRemindersPerDay,
                pushEnabled: existing.pushEnabled,
                lastActiveDate: existing.lastActiveDate,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }

          const res = await tx
            .insert(userSettings)
            .values({
              userId: uid,
              timezone: String(d.timezone || 'Asia/Kolkata'),
              wakeTime: String(d.wakeTime || '06:30'),
              quietStart: String(d.quietStart || '23:00'),
              quietEnd: String(d.quietEnd || '06:00'),
              dayRolloverHour: Number(d.dayRolloverHour ?? 4),
              dailyWorkloadMinutes: Number(d.dailyWorkloadMinutes ?? 120),
              dutyPromptTime: String(d.dutyPromptTime || '06:45'),
              reviewTime: String(d.reviewTime || '21:30'),
              maxRemindersPerDay: Number(d.maxRemindersPerDay ?? 8),
              pushEnabled: Boolean(d.pushEnabled ?? true),
              lastActiveDate:
                typeof d.lastActiveDate === 'string' ? d.lastActiveDate : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: userSettings.userId,
              set: {
                timezone: String(d.timezone || 'Asia/Kolkata'),
                wakeTime: String(d.wakeTime || '06:30'),
                quietStart: String(d.quietStart || '23:00'),
                quietEnd: String(d.quietEnd || '06:00'),
                dayRolloverHour: Number(d.dayRolloverHour ?? 4),
                dailyWorkloadMinutes: Number(d.dailyWorkloadMinutes ?? 120),
                dutyPromptTime: String(d.dutyPromptTime || '06:45'),
                reviewTime: String(d.reviewTime || '21:30'),
                maxRemindersPerDay: Number(d.maxRemindersPerDay ?? 8),
                pushEnabled: Boolean(d.pushEnabled ?? true),
                lastActiveDate:
                  typeof d.lastActiveDate === 'string' ? d.lastActiveDate : null,
                updatedAt: now,
              },
              setWhere: eq(userSettings.userId, uid),
            })
            .returning({ id: userSettings.userId });
          assertOwnedUpsert(res, 'user_settings', uid);
          results.push({
            id: op.id,
            entity: 'settings',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'lifeAreas': {
          const existing = (
            await tx
              .select()
              .from(lifeAreas)
              .where(and(eq(lifeAreas.id, op.id), eq(lifeAreas.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'lifeAreas',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                name: existing.name,
                description: existing.description,
                status: existing.status,
                sortOrder: existing.sortOrder,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(lifeAreas)
            .values({
              id: op.id,
              userId: uid,
              name: String(d.name || 'Area').slice(0, 120),
              description:
                typeof d.description === 'string' ? d.description : null,
              status: d.status === 'archived' ? 'archived' : 'active',
              sortOrder: Number(d.sortOrder ?? 0),
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: lifeAreas.id,
              set: {
                name: String(d.name || 'Area').slice(0, 120),
                description:
                  typeof d.description === 'string' ? d.description : null,
                status: d.status === 'archived' ? 'archived' : 'active',
                sortOrder: Number(d.sortOrder ?? 0),
                updatedAt: now,
              },
              setWhere: eq(lifeAreas.userId, uid),
            })
            .returning({ id: lifeAreas.id });
          assertOwnedUpsert(res, 'life_areas', op.id);
          results.push({
            id: op.id,
            entity: 'lifeAreas',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'inboxItems': {
          const existing = (
            await tx
              .select()
              .from(inboxItems)
              .where(and(eq(inboxItems.id, op.id), eq(inboxItems.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'inboxItems',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: mapInboxRow(existing, uid),
            });
            break;
          }
          const res = await tx
            .insert(inboxItems)
            .values({
              id: op.id,
              userId: uid,
              content: String(d.content || '').slice(0, 5000),
              status: String(d.status || 'new'),
              itemType: String(d.itemType || 'unknown'),
              source: String(d.source || 'manual'),
              lifeAreaId:
                typeof d.lifeAreaId === 'string' ? d.lifeAreaId : null,
              tags: Array.isArray(d.tags) ? d.tags : [],
              decisionNote:
                typeof d.decisionNote === 'string' ? d.decisionNote : null,
              linkedEntityType:
                typeof d.linkedEntityType === 'string'
                  ? d.linkedEntityType
                  : null,
              linkedEntityId:
                typeof d.linkedEntityId === 'string' ? d.linkedEntityId : null,
              aiSuggestionJson: d.aiSuggestionJson || null,
              processedAt:
                typeof d.processedAt === 'string'
                  ? new Date(d.processedAt)
                  : null,
              archivedAt:
                typeof d.archivedAt === 'string'
                  ? new Date(d.archivedAt)
                  : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: inboxItems.id,
              set: {
                content: String(d.content || '').slice(0, 5000),
                status: String(d.status || 'new'),
                itemType: String(d.itemType || 'unknown'),
                lifeAreaId:
                  typeof d.lifeAreaId === 'string' ? d.lifeAreaId : null,
                tags: Array.isArray(d.tags) ? d.tags : [],
                decisionNote:
                  typeof d.decisionNote === 'string' ? d.decisionNote : null,
                linkedEntityType:
                  typeof d.linkedEntityType === 'string'
                    ? d.linkedEntityType
                    : null,
                linkedEntityId:
                  typeof d.linkedEntityId === 'string'
                    ? d.linkedEntityId
                    : null,
                aiSuggestionJson: d.aiSuggestionJson || null,
                processedAt:
                  typeof d.processedAt === 'string'
                    ? new Date(d.processedAt)
                    : null,
                archivedAt:
                  typeof d.archivedAt === 'string'
                    ? new Date(d.archivedAt)
                    : null,
                updatedAt: now,
              },
              setWhere: eq(inboxItems.userId, uid),
            })
            .returning({ id: inboxItems.id });
          assertOwnedUpsert(res, 'inbox_items', op.id);
          results.push({
            id: op.id,
            entity: 'inboxItems',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'inboxLinks': {
          const res = await tx
            .insert(inboxLinks)
            .values({
              id: op.id,
              userId: uid,
              inboxItemId: String(d.inboxItemId || ''),
              targetType: String(d.targetType || 'task'),
              targetId: String(d.targetId || ''),
            })
            .onConflictDoUpdate({
              target: inboxLinks.id,
              set: {
                inboxItemId: String(d.inboxItemId || ''),
                targetType: String(d.targetType || 'task'),
                targetId: String(d.targetId || ''),
              },
              setWhere: eq(inboxLinks.userId, uid),
            })
            .returning({ id: inboxLinks.id });
          assertOwnedUpsert(res, 'inbox_links', op.id);
          results.push({
            id: op.id,
            entity: 'inboxLinks',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'goals': {
          const existing = (
            await tx
              .select()
              .from(goals)
              .where(and(eq(goals.id, op.id), eq(goals.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'goals',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: mapGoalRow(existing, uid),
            });
            break;
          }
          const res = await tx
            .insert(goals)
            .values({
              id: op.id,
              userId: uid,
              lifeAreaId: String(d.lifeAreaId || 'area-personal'),
              title: String(d.title || 'Goal').slice(0, 300),
              desiredOutcome:
                typeof d.desiredOutcome === 'string' ? d.desiredOutcome : null,
              purposeReason:
                typeof d.purposeReason === 'string' ? d.purposeReason : null,
              ownershipReflection:
                typeof d.ownershipReflection === 'string'
                  ? d.ownershipReflection
                  : null,
              evidenceOfProgress:
                typeof d.evidenceOfProgress === 'string'
                  ? d.evidenceOfProgress
                  : null,
              controlNotes:
                typeof d.controlNotes === 'string' ? d.controlNotes : null,
              tradeoffs: typeof d.tradeoffs === 'string' ? d.tradeoffs : null,
              capacityNotes:
                typeof d.capacityNotes === 'string' ? d.capacityNotes : null,
              tags: Array.isArray(d.tags) ? d.tags : [],
              goalType:
                d.goalType === 'ongoing_direction'
                  ? 'ongoing_direction'
                  : 'outcome',
              status: String(d.status || 'candidate'),
              targetDate:
                typeof d.targetDate === 'string' ? d.targetDate : null,
              reviewDate:
                typeof d.reviewDate === 'string' ? d.reviewDate : null,
              reviewCadence: String(d.reviewCadence || 'weekly'),
              originInboxItemId:
                typeof d.originInboxItemId === 'string'
                  ? d.originInboxItemId
                  : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: goals.id,
              set: {
                lifeAreaId: String(d.lifeAreaId || 'area-personal'),
                title: String(d.title || 'Goal').slice(0, 300),
                desiredOutcome:
                  typeof d.desiredOutcome === 'string'
                    ? d.desiredOutcome
                    : null,
                purposeReason:
                  typeof d.purposeReason === 'string' ? d.purposeReason : null,
                ownershipReflection:
                  typeof d.ownershipReflection === 'string'
                    ? d.ownershipReflection
                    : null,
                evidenceOfProgress:
                  typeof d.evidenceOfProgress === 'string'
                    ? d.evidenceOfProgress
                    : null,
                controlNotes:
                  typeof d.controlNotes === 'string' ? d.controlNotes : null,
                tradeoffs: typeof d.tradeoffs === 'string' ? d.tradeoffs : null,
                capacityNotes:
                  typeof d.capacityNotes === 'string' ? d.capacityNotes : null,
                tags: Array.isArray(d.tags) ? d.tags : [],
                goalType:
                  d.goalType === 'ongoing_direction'
                    ? 'ongoing_direction'
                    : 'outcome',
                status: String(d.status || 'candidate'),
                targetDate:
                  typeof d.targetDate === 'string' ? d.targetDate : null,
                reviewDate:
                  typeof d.reviewDate === 'string' ? d.reviewDate : null,
                reviewCadence: String(d.reviewCadence || 'weekly'),
                updatedAt: now,
              },
              setWhere: eq(goals.userId, uid),
            })
            .returning({ id: goals.id });
          assertOwnedUpsert(res, 'goals', op.id);
          results.push({
            id: op.id,
            entity: 'goals',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'projects': {
          const existing = (
            await tx
              .select()
              .from(projects)
              .where(and(eq(projects.id, op.id), eq(projects.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'projects',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                goalId: existing.goalId,
                lifeAreaId: existing.lifeAreaId,
                title: existing.title,
                description: existing.description,
                status: existing.status,
                originInboxItemId: existing.originInboxItemId,
                createdAt: existing.createdAt.toISOString(),
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(projects)
            .values({
              id: op.id,
              userId: uid,
              goalId: typeof d.goalId === 'string' ? d.goalId : null,
              lifeAreaId:
                typeof d.lifeAreaId === 'string' ? d.lifeAreaId : null,
              title: String(d.title || 'Project').slice(0, 300),
              description:
                typeof d.description === 'string' ? d.description : null,
              status: String(d.status || 'active'),
              originInboxItemId:
                typeof d.originInboxItemId === 'string'
                  ? d.originInboxItemId
                  : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: projects.id,
              set: {
                goalId: typeof d.goalId === 'string' ? d.goalId : null,
                lifeAreaId:
                  typeof d.lifeAreaId === 'string' ? d.lifeAreaId : null,
                title: String(d.title || 'Project').slice(0, 300),
                description:
                  typeof d.description === 'string' ? d.description : null,
                status: String(d.status || 'active'),
                updatedAt: now,
              },
              setWhere: eq(projects.userId, uid),
            })
            .returning({ id: projects.id });
          assertOwnedUpsert(res, 'projects', op.id);
          results.push({
            id: op.id,
            entity: 'projects',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'milestones': {
          const existing = (
            await tx
              .select()
              .from(milestones)
              .where(and(eq(milestones.id, op.id), eq(milestones.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'milestones',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                goalId: existing.goalId,
                title: existing.title,
                description: existing.description,
                status: existing.status,
                seq: existing.seq,
                createdAt: existing.createdAt.toISOString(),
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(milestones)
            .values({
              id: op.id,
              userId: uid,
              goalId: String(d.goalId || ''),
              title: String(d.title || 'Milestone').slice(0, 300),
              description:
                typeof d.description === 'string' ? d.description : null,
              status: String(d.status || 'todo'),
              seq: Number(d.seq ?? 0),
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: milestones.id,
              set: {
                title: String(d.title || 'Milestone').slice(0, 300),
                description:
                  typeof d.description === 'string' ? d.description : null,
                status: String(d.status || 'todo'),
                seq: Number(d.seq ?? 0),
                updatedAt: now,
              },
              setWhere: eq(milestones.userId, uid),
            })
            .returning({ id: milestones.id });
          assertOwnedUpsert(res, 'milestones', op.id);
          results.push({
            id: op.id,
            entity: 'milestones',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'tasks': {
          const existing = (
            await tx
              .select()
              .from(tasks)
              .where(and(eq(tasks.id, op.id), eq(tasks.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'tasks',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: mapTaskRow(existing, uid),
            });
            break;
          }
          const res = await tx
            .insert(tasks)
            .values({
              id: op.id,
              userId: uid,
              goalId: typeof d.goalId === 'string' ? d.goalId : null,
              milestoneId:
                typeof d.milestoneId === 'string' ? d.milestoneId : null,
              projectId: typeof d.projectId === 'string' ? d.projectId : null,
              parentTaskId:
                typeof d.parentTaskId === 'string' ? d.parentTaskId : null,
              originInboxItemId:
                typeof d.originInboxItemId === 'string'
                  ? d.originInboxItemId
                  : null,
              title: String(d.title || 'Task').slice(0, 500),
              nextAction:
                typeof d.nextAction === 'string' ? d.nextAction : null,
              status: String(d.status || 'todo'),
              estMinutes:
                typeof d.estMinutes === 'number' ? d.estMinutes : null,
              dueDate: typeof d.dueDate === 'string' ? d.dueDate : null,
              scheduledDate:
                typeof d.scheduledDate === 'string' ? d.scheduledDate : null,
              rescheduleCount: Number(d.rescheduleCount ?? 0),
              completedAt:
                typeof d.completedAt === 'string'
                  ? new Date(d.completedAt)
                  : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: tasks.id,
              set: {
                goalId: typeof d.goalId === 'string' ? d.goalId : null,
                milestoneId:
                  typeof d.milestoneId === 'string' ? d.milestoneId : null,
                projectId:
                  typeof d.projectId === 'string' ? d.projectId : null,
                title: String(d.title || 'Task').slice(0, 500),
                nextAction:
                  typeof d.nextAction === 'string' ? d.nextAction : null,
                status: String(d.status || 'todo'),
                estMinutes:
                  typeof d.estMinutes === 'number' ? d.estMinutes : null,
                dueDate: typeof d.dueDate === 'string' ? d.dueDate : null,
                scheduledDate:
                  typeof d.scheduledDate === 'string' ? d.scheduledDate : null,
                rescheduleCount: Number(d.rescheduleCount ?? 0),
                completedAt:
                  typeof d.completedAt === 'string'
                    ? new Date(d.completedAt)
                    : null,
                updatedAt: now,
              },
              setWhere: eq(tasks.userId, uid),
            })
            .returning({ id: tasks.id });
          assertOwnedUpsert(res, 'tasks', op.id);
          results.push({
            id: op.id,
            entity: 'tasks',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'dayPlans': {
          const existing = (
            await tx
              .select()
              .from(dayPlans)
              .where(and(eq(dayPlans.id, op.id), eq(dayPlans.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'dayPlans',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                planDate: existing.planDate,
                isOff: existing.isOff,
                dutyStart: existing.dutyStart,
                minimumDay: existing.minimumDay,
                mainTaskId: existing.mainTaskId,
                locked: existing.locked,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(dayPlans)
            .values({
              id: op.id,
              userId: uid,
              planDate: String(d.planDate || ''),
              isOff: Boolean(d.isOff ?? false),
              dutyStart:
                typeof d.dutyStart === 'string' ? d.dutyStart : null,
              minimumDay: Boolean(d.minimumDay ?? false),
              mainTaskId:
                typeof d.mainTaskId === 'string' ? d.mainTaskId : null,
              locked: Boolean(d.locked ?? false),
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: dayPlans.id,
              set: {
                isOff: Boolean(d.isOff ?? false),
                dutyStart:
                  typeof d.dutyStart === 'string' ? d.dutyStart : null,
                minimumDay: Boolean(d.minimumDay ?? false),
                mainTaskId:
                  typeof d.mainTaskId === 'string' ? d.mainTaskId : null,
                locked: Boolean(d.locked ?? false),
                updatedAt: now,
              },
              setWhere: eq(dayPlans.userId, uid),
            })
            .returning({ id: dayPlans.id });
          assertOwnedUpsert(res, 'day_plans', op.id);
          results.push({
            id: op.id,
            entity: 'dayPlans',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'routines': {
          const existing = (
            await tx
              .select()
              .from(routines)
              .where(and(eq(routines.id, op.id), eq(routines.userId, uid)))
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'routines',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                goalId: existing.goalId,
                originInboxItemId: existing.originInboxItemId,
                title: existing.title,
                block: existing.block,
                anchorType: existing.anchorType,
                clockTime: existing.clockTime,
                anchorOffsetMin: existing.anchorOffsetMin,
                appliesOn: existing.appliesOn,
                daysOfWeek: existing.daysOfWeek,
                isMust: existing.isMust,
                targetValue: existing.targetValue,
                stepValue: existing.stepValue,
                unit: existing.unit,
                checkpoints: existing.checkpoints,
                active: existing.active,
                sortOrder: existing.sortOrder,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(routines)
            .values({
              id: op.id,
              userId: uid,
              goalId: typeof d.goalId === 'string' ? d.goalId : null,
              originInboxItemId:
                typeof d.originInboxItemId === 'string'
                  ? d.originInboxItemId
                  : null,
              title: String(d.title || 'Routine').slice(0, 200),
              block: String(d.block || 'anytime'),
              anchorType: String(d.anchorType || 'clock'),
              clockTime:
                typeof d.clockTime === 'string' ? d.clockTime : null,
              anchorOffsetMin: Number(d.anchorOffsetMin ?? 0),
              appliesOn: String(d.appliesOn || 'all'),
              daysOfWeek: Array.isArray(d.daysOfWeek)
                ? d.daysOfWeek
                : [1, 2, 3, 4, 5, 6, 7],
              isMust: Boolean(d.isMust ?? false),
              targetValue:
                typeof d.targetValue === 'number' ? d.targetValue : null,
              stepValue:
                typeof d.stepValue === 'number' ? d.stepValue : null,
              unit: typeof d.unit === 'string' ? d.unit : null,
              checkpoints: Array.isArray(d.checkpoints) ? d.checkpoints : null,
              active: Boolean(d.active ?? true),
              sortOrder: Number(d.sortOrder ?? 0),
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: routines.id,
              set: {
                goalId: typeof d.goalId === 'string' ? d.goalId : null,
                title: String(d.title || 'Routine').slice(0, 200),
                block: String(d.block || 'anytime'),
                anchorType: String(d.anchorType || 'clock'),
                clockTime:
                  typeof d.clockTime === 'string' ? d.clockTime : null,
                anchorOffsetMin: Number(d.anchorOffsetMin ?? 0),
                appliesOn: String(d.appliesOn || 'all'),
                daysOfWeek: Array.isArray(d.daysOfWeek)
                  ? d.daysOfWeek
                  : [1, 2, 3, 4, 5, 6, 7],
                isMust: Boolean(d.isMust ?? false),
                targetValue:
                  typeof d.targetValue === 'number' ? d.targetValue : null,
                stepValue:
                  typeof d.stepValue === 'number' ? d.stepValue : null,
                unit: typeof d.unit === 'string' ? d.unit : null,
                checkpoints: Array.isArray(d.checkpoints)
                  ? d.checkpoints
                  : null,
                active: Boolean(d.active ?? true),
                sortOrder: Number(d.sortOrder ?? 0),
                updatedAt: now,
              },
              setWhere: eq(routines.userId, uid),
            })
            .returning({ id: routines.id });
          assertOwnedUpsert(res, 'routines', op.id);
          results.push({
            id: op.id,
            entity: 'routines',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'routineLogs': {
          const existing = (
            await tx
              .select()
              .from(routineLogs)
              .where(
                and(eq(routineLogs.id, op.id), eq(routineLogs.userId, uid))
              )
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'routineLogs',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                routineId: existing.routineId,
                logDate: existing.logDate,
                status: existing.status,
                value: existing.value,
                completedAt: existing.completedAt
                  ? existing.completedAt.toISOString()
                  : null,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(routineLogs)
            .values({
              id: op.id,
              userId: uid,
              routineId: String(d.routineId || ''),
              logDate: String(d.logDate || ''),
              status: String(d.status || 'partial'),
              value: Number(d.value ?? 0),
              completedAt:
                typeof d.completedAt === 'string'
                  ? new Date(d.completedAt)
                  : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: routineLogs.id,
              set: {
                status: String(d.status || 'partial'),
                value: Number(d.value ?? 0),
                completedAt:
                  typeof d.completedAt === 'string'
                    ? new Date(d.completedAt)
                    : null,
                updatedAt: now,
              },
              setWhere: eq(routineLogs.userId, uid),
            })
            .returning({ id: routineLogs.id });
          assertOwnedUpsert(res, 'routine_logs', op.id);
          results.push({
            id: op.id,
            entity: 'routineLogs',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'dailyReviews': {
          const existing = (
            await tx
              .select()
              .from(dailyReviews)
              .where(
                and(eq(dailyReviews.id, op.id), eq(dailyReviews.userId, uid))
              )
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'dailyReviews',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                reviewDate: existing.reviewDate,
                completedText: existing.completedText,
                pendingText: existing.pendingText,
                surpriseText: existing.surpriseText,
                changeTomorrow: existing.changeTomorrow,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(dailyReviews)
            .values({
              id: op.id,
              userId: uid,
              reviewDate: String(d.reviewDate || ''),
              completedText:
                typeof d.completedText === 'string' ? d.completedText : null,
              pendingText:
                typeof d.pendingText === 'string' ? d.pendingText : null,
              surpriseText:
                typeof d.surpriseText === 'string' ? d.surpriseText : null,
              changeTomorrow:
                typeof d.changeTomorrow === 'string' ? d.changeTomorrow : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: dailyReviews.id,
              set: {
                completedText:
                  typeof d.completedText === 'string' ? d.completedText : null,
                pendingText:
                  typeof d.pendingText === 'string' ? d.pendingText : null,
                surpriseText:
                  typeof d.surpriseText === 'string' ? d.surpriseText : null,
                changeTomorrow:
                  typeof d.changeTomorrow === 'string'
                    ? d.changeTomorrow
                    : null,
                updatedAt: now,
              },
              setWhere: eq(dailyReviews.userId, uid),
            })
            .returning({ id: dailyReviews.id });
          assertOwnedUpsert(res, 'daily_reviews', op.id);
          results.push({
            id: op.id,
            entity: 'dailyReviews',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }

        case 'weeklyReviews': {
          const existing = (
            await tx
              .select()
              .from(weeklyReviews)
              .where(
                and(eq(weeklyReviews.id, op.id), eq(weeklyReviews.userId, uid))
              )
          )[0];
          if (existing && isConflictStale(op.baseUpdatedAt, existing.updatedAt)) {
            results.push({
              id: op.id,
              entity: 'weeklyReviews',
              op: 'upsert',
              ok: false,
              conflict: true,
              serverRow: {
                id: existing.id,
                userId: uid,
                weekStart: existing.weekStart,
                accomplishments: existing.accomplishments,
                challenges: existing.challenges,
                decisions: existing.decisions,
                nextPriorities: existing.nextPriorities,
                updatedAt: existing.updatedAt.toISOString(),
              },
            });
            break;
          }
          const res = await tx
            .insert(weeklyReviews)
            .values({
              id: op.id,
              userId: uid,
              weekStart: String(d.weekStart || ''),
              accomplishments:
                typeof d.accomplishments === 'string'
                  ? d.accomplishments
                  : null,
              challenges:
                typeof d.challenges === 'string' ? d.challenges : null,
              decisions:
                typeof d.decisions === 'string' ? d.decisions : null,
              nextPriorities:
                typeof d.nextPriorities === 'string' ? d.nextPriorities : null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: weeklyReviews.id,
              set: {
                accomplishments:
                  typeof d.accomplishments === 'string'
                    ? d.accomplishments
                    : null,
                challenges:
                  typeof d.challenges === 'string' ? d.challenges : null,
                decisions:
                  typeof d.decisions === 'string' ? d.decisions : null,
                nextPriorities:
                  typeof d.nextPriorities === 'string'
                    ? d.nextPriorities
                    : null,
                updatedAt: now,
              },
              setWhere: eq(weeklyReviews.userId, uid),
            })
            .returning({ id: weeklyReviews.id });
          assertOwnedUpsert(res, 'weekly_reviews', op.id);
          results.push({
            id: op.id,
            entity: 'weeklyReviews',
            op: 'upsert',
            ok: true,
            updatedAt: nowIso,
          });
          break;
        }
      }
    }

    return results;
  });
}
