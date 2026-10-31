import { ExportPayload, Goal } from '../types';

export interface GoalGateEvaluation {
  isReadyToAccept: boolean;
  missingFields: string[];
  warnings: string[];
  advisorySleepOnIt: boolean;
  activeGoalCountWarning: boolean;
}

/**
 * V2 Section 2: Evaluates a Goal Candidate against the Quality Gate rules.
 * - Requires desired outcome (or clear title), personal reason, life area, and review cadence/date.
 * - Soft advisory if activeGoalsCount >= 5 (never blocks).
 * - Soft "sleep on it" suggestion if trade-offs mention large cost/hours or multiple life areas.
 */
export function evaluateGoalCandidateGate(
  candidate: Partial<Goal>,
  activeGoalsCount: number
): GoalGateEvaluation {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!candidate.title || candidate.title.trim().length < 3) {
    missingFields.push('Goal Title / Outcome');
  }
  if (!candidate.desiredOutcome || candidate.desiredOutcome.trim().length < 5) {
    missingFields.push('Desired Outcome (Kya alag ya sach hona chahiye)');
  }
  if (!candidate.purposeReason || candidate.purposeReason.trim().length < 3) {
    missingFields.push('Personal Reason (Kyun zaruri hai)');
  }
  if (!candidate.lifeAreaId) {
    missingFields.push('Life Area');
  }

  if (!candidate.tradeoffs || candidate.tradeoffs.trim().length === 0) {
    warnings.push(
      'Cost / Trade-off khali hai: soch lein ki is goal ke liye waqt ya energy kahan se aayegi.'
    );
  }
  if (!candidate.capacityNotes || candidate.capacityNotes.trim().length === 0) {
    warnings.push(
      'First Next Action ya capacity note likhne se shuruaat aasan hoti hai.'
    );
  }

  const combinedText = `${candidate.title || ''} ${candidate.desiredOutcome || ''} ${candidate.tradeoffs || ''}`.toLowerCase();
  const advisorySleepOnIt =
    combinedText.length > 180 ||
    /roz 3 ghante|loan|invest|quit|career switch|marathon|business/i.test(
      combinedText
    );

  const activeGoalCountWarning = activeGoalsCount >= 5;

  return {
    isReadyToAccept: missingFields.length === 0,
    missingFields,
    warnings,
    advisorySleepOnIt,
    activeGoalCountWarning,
  };
}

const MAX_COLLECTION_COUNT = 5000;
const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 300;
const MAX_LONG_TEXT_LENGTH = 5000;

const ALLOWED_AREA_STATUS = new Set(['active', 'archived']);
const ALLOWED_INBOX_STATUS = new Set([
  'new',
  'processing',
  'waiting',
  'processed',
  'someday',
  'archived',
  'trash',
]);
const ALLOWED_INBOX_TYPE = new Set([
  'unknown',
  'task',
  'goal_candidate',
  'project',
  'habit_candidate',
  'reference',
  'idea',
  'concern',
  'waiting_for',
  'duplicate',
]);
const ALLOWED_GOAL_STATUS = new Set([
  'candidate',
  'active',
  'paused',
  'completed',
  'archived',
]);
const ALLOWED_GOAL_TYPE = new Set(['outcome', 'ongoing_direction']);
const ALLOWED_PROJECT_STATUS = new Set([
  'active',
  'paused',
  'completed',
  'archived',
]);
const ALLOWED_MILESTONE_STATUS = new Set(['todo', 'doing', 'done', 'dropped']);
const ALLOWED_TASK_STATUS = new Set([
  'todo',
  'doing',
  'done',
  'paused',
  'cancelled',
]);
const ALLOWED_ROUTINE_BLOCK = new Set(['morning', 'duty', 'evening', 'anytime']);
const ALLOWED_ROUTINE_ANCHOR = new Set(['clock', 'wake', 'duty_start']);
const ALLOWED_ROUTINE_APPLIES = new Set(['all', 'duty_days', 'off_days']);
const ALLOWED_LOG_STATUS = new Set(['partial', 'done', 'skipped']);

function checkStringLen(
  val: unknown,
  maxLen: number,
  fieldLabel: string,
  errors: string[],
  required: boolean = false
): void {
  if (val === undefined || val === null) {
    if (required) {
      errors.push(`${fieldLabel} required hai.`);
    }
    return;
  }
  if (typeof val !== 'string') {
    errors.push(`${fieldLabel} string hona chahiye.`);
    return;
  }
  if (required && val.trim().length === 0) {
    errors.push(`${fieldLabel} khali nahi ho sakta.`);
    return;
  }
  if (val.length > maxLen) {
    errors.push(`${fieldLabel} max length (${maxLen}) se bada hai.`);
  }
}

function checkEnum(
  val: unknown,
  allowed: Set<string>,
  fieldLabel: string,
  errors: string[],
  required: boolean = true
): void {
  if (val === undefined || val === null) {
    if (required) {
      errors.push(`${fieldLabel} required hai.`);
    }
    return;
  }
  if (typeof val !== 'string' || !allowed.has(val)) {
    errors.push(`${fieldLabel} me invalid value "${String(val)}" hai.`);
  }
}

/**
 * Hand-written validator for /api/state sync and import payloads.
 * Enforces array types, max collection size (5000), max string lengths, and allowed enum values.
 */
export function validateSyncStatePayload(stateObj: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!stateObj || typeof stateObj !== 'object' || Array.isArray(stateObj)) {
    return { ok: false, errors: ['State payload valid object nahi hai.'] };
  }

  const s = stateObj as Record<string, unknown>;

  const requiredArrays = [
    'lifeAreas',
    'inboxItems',
    'goals',
    'tasks',
    'routines',
  ] as const;

  const optionalArrays = [
    'inboxLinks',
    'projects',
    'milestones',
    'dayPlans',
    'routineLogs',
    'dailyReviews',
    'weeklyReviews',
    'reminderSent',
  ] as const;

  for (const key of requiredArrays) {
    if (!Array.isArray(s[key])) {
      errors.push(`Table "${key}" ek valid array nahi hai.`);
    } else if ((s[key] as unknown[]).length > MAX_COLLECTION_COUNT) {
      errors.push(
        `Table "${key}" me max ${MAX_COLLECTION_COUNT} items allowed hain.`
      );
    }
  }

  for (const key of optionalArrays) {
    if (s[key] !== undefined && s[key] !== null) {
      if (!Array.isArray(s[key])) {
        errors.push(`Table "${key}" ek valid array nahi hai.`);
      } else if ((s[key] as unknown[]).length > MAX_COLLECTION_COUNT) {
        errors.push(
          `Table "${key}" me max ${MAX_COLLECTION_COUNT} items allowed hain.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (s.settings !== undefined && s.settings !== null) {
    if (typeof s.settings !== 'object' || Array.isArray(s.settings)) {
      errors.push('settings valid object hona chahiye.');
    } else {
      const st = s.settings as Record<string, unknown>;
      checkStringLen(st.timezone, 80, 'settings.timezone', errors, false);
    }
  }

  for (const [idx, item] of (s.lifeAreas as unknown[]).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`lifeAreas[${idx}] valid object nahi hai.`);
      continue;
    }
    const a = item as Record<string, unknown>;
    checkStringLen(a.id, MAX_ID_LENGTH, `lifeAreas[${idx}].id`, errors, true);
    checkStringLen(
      a.name,
      MAX_TITLE_LENGTH,
      `lifeAreas[${idx}].name`,
      errors,
      true
    );
    checkStringLen(
      a.description,
      MAX_LONG_TEXT_LENGTH,
      `lifeAreas[${idx}].description`,
      errors,
      false
    );
    checkEnum(
      a.status,
      ALLOWED_AREA_STATUS,
      `lifeAreas[${idx}].status`,
      errors,
      false
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of (s.inboxItems as unknown[]).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`inboxItems[${idx}] valid object nahi hai.`);
      continue;
    }
    const inb = item as Record<string, unknown>;
    checkStringLen(
      inb.id,
      MAX_ID_LENGTH,
      `inboxItems[${idx}].id`,
      errors,
      true
    );
    checkStringLen(
      inb.content,
      MAX_LONG_TEXT_LENGTH,
      `inboxItems[${idx}].content`,
      errors,
      true
    );
    checkStringLen(
      inb.decisionNote,
      MAX_LONG_TEXT_LENGTH,
      `inboxItems[${idx}].decisionNote`,
      errors,
      false
    );
    checkEnum(
      inb.status,
      ALLOWED_INBOX_STATUS,
      `inboxItems[${idx}].status`,
      errors,
      true
    );
    checkEnum(
      inb.itemType,
      ALLOWED_INBOX_TYPE,
      `inboxItems[${idx}].itemType`,
      errors,
      true
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of (s.goals as unknown[]).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`goals[${idx}] valid object nahi hai.`);
      continue;
    }
    const g = item as Record<string, unknown>;
    checkStringLen(g.id, MAX_ID_LENGTH, `goals[${idx}].id`, errors, true);
    checkStringLen(
      g.title,
      MAX_TITLE_LENGTH,
      `goals[${idx}].title`,
      errors,
      true
    );
    checkStringLen(
      g.desiredOutcome,
      MAX_LONG_TEXT_LENGTH,
      `goals[${idx}].desiredOutcome`,
      errors,
      false
    );
    checkStringLen(
      g.purposeReason,
      MAX_LONG_TEXT_LENGTH,
      `goals[${idx}].purposeReason`,
      errors,
      false
    );
    checkEnum(
      g.status,
      ALLOWED_GOAL_STATUS,
      `goals[${idx}].status`,
      errors,
      true
    );
    checkEnum(
      g.goalType,
      ALLOWED_GOAL_TYPE,
      `goals[${idx}].goalType`,
      errors,
      true
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of ((s.projects as unknown[]) || []).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`projects[${idx}] valid object nahi hai.`);
      continue;
    }
    const p = item as Record<string, unknown>;
    checkStringLen(p.id, MAX_ID_LENGTH, `projects[${idx}].id`, errors, true);
    checkStringLen(
      p.title,
      MAX_TITLE_LENGTH,
      `projects[${idx}].title`,
      errors,
      true
    );
    checkStringLen(
      p.description,
      MAX_LONG_TEXT_LENGTH,
      `projects[${idx}].description`,
      errors,
      false
    );
    checkEnum(
      p.status,
      ALLOWED_PROJECT_STATUS,
      `projects[${idx}].status`,
      errors,
      false
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of ((s.milestones as unknown[]) || []).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`milestones[${idx}] valid object nahi hai.`);
      continue;
    }
    const m = item as Record<string, unknown>;
    checkStringLen(m.id, MAX_ID_LENGTH, `milestones[${idx}].id`, errors, true);
    checkStringLen(
      m.title,
      MAX_TITLE_LENGTH,
      `milestones[${idx}].title`,
      errors,
      true
    );
    checkEnum(
      m.status,
      ALLOWED_MILESTONE_STATUS,
      `milestones[${idx}].status`,
      errors,
      false
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of (s.tasks as unknown[]).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`tasks[${idx}] valid object nahi hai.`);
      continue;
    }
    const t = item as Record<string, unknown>;
    checkStringLen(t.id, MAX_ID_LENGTH, `tasks[${idx}].id`, errors, true);
    checkStringLen(
      t.title,
      MAX_TITLE_LENGTH,
      `tasks[${idx}].title`,
      errors,
      true
    );
    checkStringLen(
      t.nextAction,
      MAX_LONG_TEXT_LENGTH,
      `tasks[${idx}].nextAction`,
      errors,
      false
    );
    checkEnum(
      t.status,
      ALLOWED_TASK_STATUS,
      `tasks[${idx}].status`,
      errors,
      true
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of (s.routines as unknown[]).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`routines[${idx}] valid object nahi hai.`);
      continue;
    }
    const r = item as Record<string, unknown>;
    checkStringLen(r.id, MAX_ID_LENGTH, `routines[${idx}].id`, errors, true);
    checkStringLen(
      r.title,
      MAX_TITLE_LENGTH,
      `routines[${idx}].title`,
      errors,
      true
    );
    checkEnum(
      r.block,
      ALLOWED_ROUTINE_BLOCK,
      `routines[${idx}].block`,
      errors,
      true
    );
    checkEnum(
      r.anchorType,
      ALLOWED_ROUTINE_ANCHOR,
      `routines[${idx}].anchorType`,
      errors,
      true
    );
    checkEnum(
      r.appliesOn,
      ALLOWED_ROUTINE_APPLIES,
      `routines[${idx}].appliesOn`,
      errors,
      true
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  for (const [idx, item] of ((s.routineLogs as unknown[]) || []).entries()) {
    if (!item || typeof item !== 'object') {
      errors.push(`routineLogs[${idx}] valid object nahi hai.`);
      continue;
    }
    const l = item as Record<string, unknown>;
    checkStringLen(
      l.routineId,
      MAX_ID_LENGTH,
      `routineLogs[${idx}].routineId`,
      errors,
      true
    );
    checkEnum(
      l.status,
      ALLOWED_LOG_STATUS,
      `routineLogs[${idx}].status`,
      errors,
      true
    );
    if (errors.length >= 10) return { ok: false, errors };
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Section 7.3 & S9: Validates an imported JSON backup file before restoring.
 */
export function validateImportPayload(obj: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['File valid JSON object nahi hai.'] };
  }

  const payload = obj as Partial<ExportPayload>;
  if (
    payload.app !== 'goal-os' &&
    payload.app !== 'abhios' &&
    payload.app !== 'abhi-os'
  ) {
    errors.push('Invalid app identifier: "abhios" ya "goal-os" hona chahiye.');
  }
  if (typeof payload.version !== 'number' || payload.version < 1) {
    errors.push('Invalid export version.');
  }
  if (!payload.tables || typeof payload.tables !== 'object') {
    errors.push('Missing "tables" object in backup JSON.');
    return { ok: false, errors };
  }

  const stateCheck = validateSyncStatePayload(payload.tables);
  if (!stateCheck.ok) {
    errors.push(...stateCheck.errors);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
