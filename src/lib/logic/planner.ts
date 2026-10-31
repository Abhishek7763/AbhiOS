import {
  AppStateData,
  DayPlan,
  Goal,
  LifeArea,
  Milestone,
  Routine,
  RoutineBlock,
  RoutineLog,
  Task,
  TaskRecurrence,
} from '../types';
import { addDays, daysBetween, isoDow } from './dates';

/**
 * Section 9.2: Score a task for Main Priority recommendation.
 * urgency:
 *   due today: 100
 *   overdue (<14d): 90
 *   due tomorrow: 70
 *   due <=3 days: 50
 *   due <=7 days: 25
 *   stale overdue (>=14d): 10 (needs review, not automatic top priority)
 *   scheduled today: 60 (if no closer due date)
 *   no date: 0
 * goalBonus: +10 if linked to an active goal
 * shortBonus: +5 if estMinutes <= 30
 */
export function scoreTaskForPriority(
  task: Task,
  today: string,
  activeGoalIds: Set<string>
): number {
  let urgency = 0;

  if (task.dueDate) {
    const diff = daysBetween(today, task.dueDate); // dueDate - today
    if (diff === 0) {
      urgency = 100;
    } else if (diff < 0) {
      const overdueDays = Math.abs(diff);
      urgency = overdueDays < 14 ? 90 : 10;
    } else if (diff === 1) {
      urgency = 70;
    } else if (diff <= 3) {
      urgency = 50;
    } else if (diff <= 7) {
      urgency = 25;
    } else {
      urgency = 5;
    }
  }

  if (task.scheduledDate === today && urgency < 65) {
    urgency = 65;
  }

  const goalBonus =
    task.goalId && activeGoalIds.has(task.goalId) ? 10 : 0;
  const est = task.estMinutes ?? 30;
  const shortBonus = est <= 30 ? 5 : 0;

  return urgency + goalBonus + shortBonus;
}

/**
 * Section 9.2: Suggests the single best Main Priority task for today.
 */
export function suggestMainPriority(
  tasks: Task[],
  today: string,
  activeGoalIds: Set<string> = new Set()
): Task | null {
  const candidates = tasks.filter(
    (t) => t.status === 'todo' || t.status === 'doing'
  );
  if (candidates.length === 0) return null;

  const scored = candidates.map((task) => ({
    task,
    score: scoreTaskForPriority(task, today, activeGoalIds),
    est: task.estMinutes ?? 30,
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.est - b.est;
  });

  return scored[0].task;
}

/**
 * Section 9.3: Suggests a manageable set of day tasks within 80% of available workload minutes.
 */
export function suggestDayTasks(
  tasks: Task[],
  availableMinutes: number,
  today: string,
  activeGoalIds: Set<string> = new Set(),
  lockedMainTaskId?: string | null
): {
  mainTask: Task | null;
  suggestedTasks: Task[];
  totalMinutes: number;
  budgetMinutes: number;
} {
  const budgetMinutes = Math.max(15, Math.floor(availableMinutes * 0.8));
  const candidates = tasks.filter(
    (t) => t.status === 'todo' || t.status === 'doing'
  );

  if (candidates.length === 0) {
    return {
      mainTask: null,
      suggestedTasks: [],
      totalMinutes: 0,
      budgetMinutes,
    };
  }

  let mainTask: Task | null = null;
  if (lockedMainTaskId) {
    mainTask = candidates.find((t) => t.id === lockedMainTaskId) || null;
  }
  if (!mainTask) {
    mainTask = suggestMainPriority(candidates, today, activeGoalIds);
  }

  const remaining = candidates
    .filter((t) => t.id !== mainTask?.id)
    .map((task) => ({
      task,
      score: scoreTaskForPriority(task, today, activeGoalIds),
      est: task.estMinutes ?? 30,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.est - b.est;
    });

  const suggestedTasks: Task[] = [];
  let totalMinutes = 0;

  if (mainTask) {
    suggestedTasks.push(mainTask);
    totalMinutes += mainTask.estMinutes ?? 30;
  }

  for (const item of remaining) {
    if (totalMinutes + item.est <= budgetMinutes) {
      suggestedTasks.push(item.task);
      totalMinutes += item.est;
    }
  }

  return {
    mainTask,
    suggestedTasks,
    totalMinutes,
    budgetMinutes,
  };
}

/**
 * Section 9.4: Filters routines that apply today based on day of week, duty/off status, and Minimum Viable Day.
 */
export function filterRoutinesForToday(
  routines: Routine[],
  todayDate: string,
  dayPlan?: Pick<DayPlan, 'isOff' | 'minimumDay'> | null
): Routine[] {
  const dow = isoDow(todayDate);
  const isOff = dayPlan?.isOff ?? false;
  const minimumDay = dayPlan?.minimumDay ?? false;

  return routines
    .filter((r) => {
      if (!r.active) return false;
      if (Array.isArray(r.daysOfWeek) && !r.daysOfWeek.includes(dow)) {
        return false;
      }
      if (r.appliesOn === 'duty_days' && isOff) return false;
      if (r.appliesOn === 'off_days' && !isOff) return false;
      if (minimumDay && !r.isMust) return false;
      return true;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Section 9.5: Pure water / value increment logic.
 * value += delta.
 * value >= target => status 'done'
 * value > 0 => status 'partial'
 * value <= 0 => returns null (row should be deleted)
 */
export function applyWaterDelta(
  currentLog: RoutineLog | undefined | null,
  routine: Pick<Routine, 'id' | 'targetValue'>,
  delta: number,
  todayDate: string,
  userId: string
): RoutineLog | null {
  const prevValue = currentLog?.value ?? 0;
  const nextValue = Math.max(0, prevValue + delta);

  if (nextValue <= 0) {
    return null;
  }

  const target = routine.targetValue ?? 2500;
  const isDone = nextValue >= target;

  return {
    id: currentLog?.id || `${routine.id}_${todayDate}`,
    userId,
    routineId: routine.id,
    logDate: todayDate,
    value: nextValue,
    status: isDone ? 'done' : 'partial',
    completedAt: isDone ? new Date().toISOString() : null,
  };
}

export interface DutyShiftPreset {
  id: 'morning' | 'general' | 'afternoon' | 'night' | 'off';
  label: string;
  dutyStart: string | null;
  isOff: boolean;
}

export const DUTY_SHIFT_PRESETS: DutyShiftPreset[] = [
  { id: 'morning', label: 'Morning (08:30)', dutyStart: '08:30', isOff: false },
  { id: 'general', label: 'General (10:00)', dutyStart: '10:00', isOff: false },
  {
    id: 'afternoon',
    label: 'Afternoon (14:00)',
    dutyStart: '14:00',
    isOff: false,
  },
  { id: 'night', label: 'Night (22:00)', dutyStart: '22:00', isOff: false },
  { id: 'off', label: 'Off Day (Chhutti)', dutyStart: null, isOff: true },
];

/**
 * Formats seconds into MM:SS for the Focus Timer.
 */
export function formatFocusSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Computes percentage progress (0..100) for the Focus Timer given remaining and total seconds.
 */
export function computeFocusProgress(
  remainingSeconds: number,
  totalSeconds: number
): number {
  if (totalSeconds <= 0) return 0;
  const elapsed = Math.max(0, totalSeconds - remainingSeconds);
  return Math.min(100, Math.max(0, Math.round((elapsed / totalSeconds) * 100)));
}

/**
 * Generates an Implementation Intention ("Agar-To" / If-Then obstacle plan) for a task or goal.
 */
export function suggestIfThenPlan(
  title: string,
  nextAction?: string | null
): string {
  const step = (nextAction || title).trim();
  const shortStep = step.length > 65 ? `${step.slice(0, 62)}...` : step;
  return `Agar duty ke baad thakan ya time kam ho, to sirf 5 minute dekar ye shuru karunga: "${shortStep}"`;
}

export interface RecurringTaskTemplate {
  id: string;
  title: string;
  nextAction: string;
  cadenceLabel: string;
  estMinutes: number;
  ifThenPlan: string;
}

export const DEFAULT_RECURRING_TEMPLATES: RecurringTaskTemplate[] = [
  {
    id: 'tpl-bills',
    title: 'Monthly Electricity & WiFi Bill Clear Karna',
    nextAction: 'UPI app khol kar electricity aur broadband bill check & pay karo',
    cadenceLabel: 'Har Mahine (1–5 Tareekh)',
    estMinutes: 10,
    ifThenPlan:
      'Agar sham ko yaad aaye, to turant 2 minute me kam se kam electricity bill pay kar dunga.',
  },
  {
    id: 'tpl-fund',
    title: 'Emergency Fund Auto-Transfer Check',
    nextAction: 'Salary aane par ₹5,000 liquid savings account me transfer karo',
    cadenceLabel: 'Har Mahine (Salary Day)',
    estMinutes: 10,
    ifThenPlan:
      'Agar mahine me kharch zyada ho, to bhi kam se kam ₹2,000 zarur transfer karunga.',
  },
  {
    id: 'tpl-room',
    title: 'Weekly Room, Bag & Uniform Reset',
    nextAction: 'Agle hafte ki duty uniform aur zaruri documents ek jagah set karo',
    cadenceLabel: 'Har Sunday Sham',
    estMinutes: 20,
    ifThenPlan:
      'Agar pura kamra saaf karne ka man na ho, to sirf kal ki duty uniform aur bag ready rakhunga.',
  },
  {
    id: 'tpl-bike',
    title: 'Bike Engine Oil, Tyre Air & Chain Check',
    nextAction: 'Fuel pump par air pressure check karwao aur service due note karo',
    cadenceLabel: 'Har 2 Hafte / 3 Mahine',
    estMinutes: 25,
    ifThenPlan:
      'Agar service center jaane ka waqt na ho, to duty se aate waqt tyre air pressure check karwa lunga.',
  },
];

export const PRESET_GOAL_TAGS: string[] = [
  '#health',
  '#relationship',
  '#finance',
  '#duty-career',
  '#family',
  '#daily-system',
  '#peace',
  '#learning',
];

/**
 * Normalizes a list or comma-separated string of tags into clean #tag tokens.
 */
export function normalizeGoalTags(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : input.split(/[,\s]+/);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of rawList) {
    const trimmed = item.trim().toLowerCase().replace(/^#+/, '');
    if (!trimmed) continue;
    const formatted = `#${trimmed}`;
    if (!seen.has(formatted)) {
      seen.add(formatted);
      result.push(formatted);
    }
  }
  return result;
}

/**
 * Computes Today's completion momentum across today's scheduled/completed tasks and active routines.
 */
export function computeTodayMomentum(params: {
  todayPendingCount: number;
  todayCompletedCount: number;
  routinesDoneCount: number;
  routinesTotalCount: number;
}): {
  completedUnits: number;
  totalUnits: number;
  percent: number;
  encouragement: string;
} {
  const completedUnits = params.todayCompletedCount + params.routinesDoneCount;
  const totalUnits =
    params.todayPendingCount +
    params.todayCompletedCount +
    params.routinesTotalCount;

  if (totalUnits <= 0) {
    return {
      completedUnits: 0,
      totalUnits: 0,
      percent: 0,
      encouragement: 'Chhote step se shuruat karein — har tick momentum banata hai.',
    };
  }

  const percent = Math.min(
    100,
    Math.max(0, Math.round((completedUnits / totalUnits) * 100))
  );

  let encouragement = 'Chhote step se shuruat karein — har tick momentum banata hai.';
  if (percent >= 100) {
    encouragement = 'Shandaar! Aaj ke sabhi planned kaam aur routines pure ho gaye! 🌟';
  } else if (percent >= 60) {
    encouragement = 'Bahut badhiya! Aap aaj ke aadhe se zyada kaam pure kar chuke hain! 🔥';
  } else if (completedUnits > 0) {
    encouragement = 'Badhiya shuruat! Ek-ek tick karke momentum ban raha hai! ✨';
  }

  return {
    completedUnits,
    totalUnits,
    percent,
    encouragement,
  };
}

export interface ContextualBrainDumpSuggestion {
  suggestedAreaId: string | null;
  suggestedGoalId: string | null;
  matchedReason: string | null;
}

/**
 * Deterministically inspects a typed Brain Dump item and suggests the most relevant
 * Goal Category (LifeArea) and/or specific active Goal without forcing the choice.
 */
export function suggestContextualBrainDumpMatch(
  rawText: string,
  lifeAreas: { id: string; name: string; status?: string }[],
  goals: { id: string; title: string; lifeAreaId: string; status: string }[]
): ContextualBrainDumpSuggestion {
  const text = (rawText || '').trim().toLowerCase();
  if (text.length < 3) {
    return {
      suggestedAreaId: null,
      suggestedGoalId: null,
      matchedReason: null,
    };
  }

  const activeAreas = lifeAreas.filter((a) => !a.status || a.status === 'active');
  const activeGoals = goals.filter((g) => g.status === 'active');

  const categoryRules: {
    areaIdHint: string;
    nameKeywords: string[];
    textKeywords: string[];
    label: string;
  }[] = [
    {
      areaIdHint: 'area-health',
      nameKeywords: ['health', 'fitness', 'sehat'],
      textKeywords: [
        'paani',
        'water',
        'walk',
        'morning walk',
        'run',
        'gym',
        'diet',
        'exercise',
        'health',
        'neend',
        'sleep',
        'yoga',
        'fitness',
        'weight',
        'medical',
        'doctor',
        'workout',
      ],
      label: 'Health keywords mile',
    },
    {
      areaIdHint: 'area-finance',
      nameKeywords: ['finance', 'money', 'paisa', 'wealth'],
      textKeywords: [
        '₹',
        'rs ',
        'paisa',
        'money',
        'fund',
        'emergency fund',
        'sip',
        'bank',
        'loan',
        'emi',
        'bill',
        'saving',
        'budget',
        'finance',
        'invest',
        'salary',
        'kharch',
      ],
      label: 'Finance & money keywords mile',
    },
    {
      areaIdHint: 'area-relationships',
      nameKeywords: ['relationship', 'family', 'parivar'],
      textKeywords: [
        'family',
        'ghar',
        'mummy',
        'papa',
        'parents',
        'wife',
        'partner',
        'dost',
        'friend',
        'call',
        'relationship',
        'rishta',
        'gift',
        'birthday',
      ],
      label: 'Relationship & family keywords mile',
    },
    {
      areaIdHint: 'area-career',
      nameKeywords: ['career', 'duty', 'work', 'job'],
      textKeywords: [
        'duty',
        'office',
        'shift',
        'exam',
        'study',
        'promotion',
        'career',
        'work',
        'project',
        'training',
        'skill',
        'uniform',
      ],
      label: 'Career & Duty keywords mile',
    },
    {
      areaIdHint: 'area-personal',
      nameKeywords: ['personal', 'peace', 'self'],
      textKeywords: [
        'peace',
        'relax',
        'meditation',
        'book',
        'read',
        'room',
        'clean',
        'bike',
        'servicing',
        'engine oil',
        'hobby',
      ],
      label: 'Personal & Peace keywords mile',
    },
  ];

  let suggestedAreaId: string | null = null;
  let matchedReason: string | null = null;

  for (const rule of categoryRules) {
    const matchedKeyword = rule.textKeywords.find((kw) => text.includes(kw));
    if (matchedKeyword) {
      const matchedArea =
        activeAreas.find((a) => a.id === rule.areaIdHint) ||
        activeAreas.find((a) =>
          rule.nameKeywords.some((nk) => a.name.toLowerCase().includes(nk))
        );
      if (matchedArea) {
        suggestedAreaId = matchedArea.id;
        matchedReason = `${rule.label} ("${matchedKeyword}")`;
        break;
      }
    }
  }

  // Also check if any active Goal title shares meaningful words (>= 4 chars) with the input
  const words = text
    .replace(/[^a-z0-9\u0900-\u097F\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  let bestGoalId: string | null = null;
  let bestScore = 0;

  for (const goal of activeGoals) {
    const goalTitleLower = goal.title.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (goalTitleLower.includes(w)) {
        score += 2;
      }
    }
    if (suggestedAreaId && goal.lifeAreaId === suggestedAreaId) {
      score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestGoalId = goal.id;
    }
  }

  if (!suggestedAreaId && bestGoalId) {
    const foundGoal = activeGoals.find((g) => g.id === bestGoalId);
    if (foundGoal) {
      suggestedAreaId = foundGoal.lifeAreaId;
      matchedReason = 'Matching Goal mila';
    }
  }

  return {
    suggestedAreaId,
    suggestedGoalId: bestGoalId,
    matchedReason,
  };
}

export interface GoalProgressSummary {
  completedSteps: number;
  totalSteps: number;
  percent: number;
  nextUpTask: Task | null;
  nextUpMilestone: Milestone | null;
}

/**
 * Computes visual progress (milestones + tasks) and identifies the immediate Next Up step for a Goal.
 */
export function computeGoalProgressAndNextStep(
  goalId: string,
  milestones: Milestone[],
  tasks: Task[]
): GoalProgressSummary {
  const goalMilestones = milestones
    .filter((m) => m.goalId === goalId && m.status !== 'dropped')
    .sort((a, b) => a.seq - b.seq);
  const goalTasks = tasks.filter(
    (t) => t.goalId === goalId && t.status !== 'cancelled'
  );

  const msDone = goalMilestones.filter((m) => m.status === 'done').length;
  const tasksDone = goalTasks.filter((t) => t.status === 'done').length;

  const completedSteps = msDone + tasksDone;
  const totalSteps = goalMilestones.length + goalTasks.length;
  const percent =
    totalSteps > 0
      ? Math.min(100, Math.max(0, Math.round((completedSteps / totalSteps) * 100)))
      : 0;

  const nextUpTask =
    goalTasks.find((t) => t.status === 'todo' || t.status === 'doing') || null;
  const nextUpMilestone =
    goalMilestones.find((m) => m.status === 'todo' || m.status === 'doing') ||
    null;

  return {
    completedSteps,
    totalSteps,
    percent,
    nextUpTask,
    nextUpMilestone,
  };
}

/**
 * Computes the next scheduled date for a recurring task ('daily' | 'weekly' | 'monthly').
 */
export function computeNextRecurrenceDate(
  baseDate: string,
  recurrence: TaskRecurrence | undefined | null
): string | null {
  if (!recurrence || recurrence === 'none') return null;
  if (recurrence === 'daily') return addDays(baseDate, 1);
  if (recurrence === 'weekly') return addDays(baseDate, 7);
  if (recurrence === 'monthly') {
    const parts = baseDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      return addDays(baseDate, 30);
    }
    const [year, month, day] = parts;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const maxDayInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    const clampedDay = Math.min(day, maxDayInNextMonth);
    return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(
      2,
      '0'
    )}-${String(clampedDay).padStart(2, '0')}`;
  }
  return null;
}

/**
 * Generates a gentle 2-minute micro-starter breakdown for stuck tasks or stuck thoughts.
 */
export function generateTwoMinuteStarter(
  title: string,
  nextAction?: string | null
): [string, string] {
  const clean = (title || nextAction || 'Kaam').trim();
  const short = clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
  return [
    `[2-Min Shuruat]: Sirf 2 minute dekar pehla chhota hissa kholo — ${short}`,
    `[Agla Step]: Jab shuruat ho jaye tab baaki hissa pura karo — ${short}`,
  ];
}

export interface CategoryBalanceItem {
  areaId: string;
  name: string;
  activeGoalsCount: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  statusLabel: string;
}

/**
 * Computes a calm, non-guilt Life Balance Snapshot across active departments.
 */
export function computeLifeBalanceSnapshot(
  lifeAreas: LifeArea[],
  goals: Goal[],
  tasks: Task[]
): {
  items: CategoryBalanceItem[];
  calmInsight: string;
} {
  const activeAreas = lifeAreas.filter((a) => a.status === 'active');
  const goalAreaMap = new Map<string, string>();
  for (const g of goals) {
    goalAreaMap.set(g.id, g.lifeAreaId);
  }

  const items: CategoryBalanceItem[] = activeAreas.map((area) => {
    const areaGoals = goals.filter(
      (g) =>
        g.lifeAreaId === area.id &&
        (g.status === 'active' || g.status === 'candidate')
    );
    const areaTasks = tasks.filter(
      (t) =>
        t.goalId &&
        goalAreaMap.get(t.goalId) === area.id &&
        t.status !== 'cancelled'
    );
    const completedTasksCount = areaTasks.filter(
      (t) => t.status === 'done'
    ).length;
    const pendingTasksCount = areaTasks.filter(
      (t) => t.status === 'todo' || t.status === 'doing'
    ).length;

    let statusLabel = 'Shant / Optional';
    if (completedTasksCount > 0) {
      statusLabel = `${completedTasksCount} Done · Active`;
    } else if (pendingTasksCount > 0 || areaGoals.length > 0) {
      statusLabel = `${areaGoals.length} Goal · Ready`;
    }

    return {
      areaId: area.id,
      name: area.name,
      activeGoalsCount: areaGoals.length,
      completedTasksCount,
      pendingTasksCount,
      statusLabel,
    };
  });

  const activeNames = items
    .filter((i) => i.activeGoalsCount > 0 || i.completedTasksCount > 0)
    .map((i) => i.name);
  const quietArea = items.find(
    (i) => i.activeGoalsCount === 0 && i.completedTasksCount === 0
  );

  let calmInsight =
    'Sabhi departments santulit hain — ek waqt par 1-2 focus areas kaafi hain.';
  if (activeNames.length > 0 && quietArea) {
    calmInsight = `Abhi focus ${activeNames
      .slice(0, 2)
      .join(' & ')} par hai · Jab waqt mile tab ${quietArea.name} dekhein (no rush).`;
  } else if (activeNames.length > 0) {
    calmInsight = `${activeNames.length} departments me goals active hain — har department roz karna zaruri nahi hai.`;
  }

  return { items, calmInsight };
}

export interface GlobalSearchResult {
  id: string;
  kind: 'inbox' | 'goal' | 'task' | 'routine';
  title: string;
  subtitle: string;
  badge: string;
  targetTab: 'inbox' | 'goals' | 'tasks' | 'today';
}

/**
 * Performs an instant, case-insensitive search across Brain Dump thoughts, Goals, Tasks, and Routines.
 */
export function searchAllEntities(
  rawQuery: string,
  state: Pick<
    AppStateData,
    'inboxItems' | 'goals' | 'tasks' | 'routines' | 'lifeAreas'
  >
): GlobalSearchResult[] {
  const q = (rawQuery || '').trim().toLowerCase();
  if (!q) return [];

  const areaNameById = new Map<string, string>();
  for (const a of state.lifeAreas || []) {
    areaNameById.set(a.id, a.name);
  }

  const results: GlobalSearchResult[] = [];

  for (const item of state.inboxItems || []) {
    if (item.status === 'trash') continue;
    const hay = `${item.content} ${(item.tags || []).join(' ')} ${
      item.decisionNote || ''
    }`.toLowerCase();
    if (hay.includes(q)) {
      const areaName = item.lifeAreaId
        ? areaNameById.get(item.lifeAreaId) || 'Brain Dump'
        : 'Brain Dump';
      results.push({
        id: item.id,
        kind: 'inbox',
        title: item.content,
        subtitle: `${areaName} · Status: ${item.status}`,
        badge: 'Brain Dump',
        targetTab: 'inbox',
      });
    }
  }

  for (const goal of state.goals || []) {
    const hay = `${goal.title} ${goal.desiredOutcome || ''} ${
      goal.purposeReason || ''
    } ${(goal.tags || []).join(' ')}`.toLowerCase();
    if (hay.includes(q)) {
      const areaName = areaNameById.get(goal.lifeAreaId) || 'Goal';
      results.push({
        id: goal.id,
        kind: 'goal',
        title: goal.title,
        subtitle: `${areaName} · ${
          goal.goalType === 'ongoing_direction' ? '♾️ Ongoing' : '🎯 Goal'
        }`,
        badge: 'Goal',
        targetTab: 'goals',
      });
    }
  }

  for (const task of state.tasks || []) {
    const hay = `${task.title} ${task.nextAction || ''}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: task.id,
        kind: 'task',
        title: task.title,
        subtitle: `${task.status.toUpperCase()} · ${
          task.scheduledDate || 'Unscheduled'
        }`,
        badge: 'Task',
        targetTab: 'tasks',
      });
    }
  }

  for (const rt of state.routines || []) {
    if (rt.title.toLowerCase().includes(q)) {
      results.push({
        id: rt.id,
        kind: 'routine',
        title: rt.title,
        subtitle: `Block: ${rt.block} · ${rt.isMust ? 'Must' : 'Routine'}`,
        badge: 'Routine',
        targetTab: 'today',
      });
    }
  }

  return results.slice(0, 20);
}

export interface WeeklyRosterInputEntry {
  date: string;
  isOff?: boolean;
  dutyStart?: string | null;
}

/**
 * Builds next 7 consecutive DayPlan records starting from startDate.
 * Merges presets and user choices, keeping existing non-duty properties intact.
 */
export function buildWeeklyDutyRoster(
  startDate: string,
  entries: WeeklyRosterInputEntry[] = [],
  existingDayPlans: DayPlan[] = [],
  userId: string = 'local-user'
): DayPlan[] {
  const existingMap = new Map<string, DayPlan>();
  for (const dp of existingDayPlans) {
    existingMap.set(dp.planDate, dp);
  }

  const entriesMap = new Map<string, WeeklyRosterInputEntry>();
  for (const entry of entries) {
    if (entry.date) {
      entriesMap.set(entry.date, entry);
    }
  }

  const result: DayPlan[] = [];

  for (let i = 0; i < 7; i++) {
    const curDate = addDays(startDate, i);
    const existing = existingMap.get(curDate);
    const override = entriesMap.get(curDate);

    const isOff =
      override?.isOff !== undefined
        ? Boolean(override.isOff)
        : (existing?.isOff ?? false);

    const dutyStart = isOff
      ? null
      : override?.dutyStart !== undefined
        ? override.dutyStart
        : (existing?.dutyStart || '08:30');

    result.push({
      id: existing?.id || `${userId}_${curDate}`,
      userId: existing?.userId || userId,
      planDate: curDate,
      isOff,
      dutyStart,
      minimumDay: existing?.minimumDay ?? false,
      mainTaskId: existing?.mainTaskId ?? null,
      locked: existing?.locked ?? false,
    });
  }

  return result;
}

export interface RoutineInsightItem {
  routineId: string;
  title: string;
  block: RoutineBlock;
  doneCount: number;
  applicableDays: number;
  missedCount: number;
  completionRatePercent: number;
  mostCommonMissedWindow: RoutineBlock;
  gentleSuggestionKey:
    | 'morning_shift_30m'
    | 'duty_anchor_ready'
    | 'evening_winddown'
    | 'water_reduce_step'
    | 'simplify_or_reduce'
    | null;
  isInsufficientData: boolean;
}

export interface RoutineInsightsReport {
  insights: RoutineInsightItem[];
  hasInsights: boolean;
  calmSummaryText: string;
}

/**
 * Pure function: Analyzes routine performance over the last N days (default 14).
 * Strict rules:
 * - NO streaks
 * - NO scores or grades
 * - NO red/guilt UI flags
 * - Respects off days (when appliesOn === 'duty_days'), inactive routines, and minimum-day filter
 * - Only suggests a gentle adjustment when missed on >= 5 of the last 14 applicable days.
 */
export function computeRoutineInsights(
  routines: Routine[],
  logs: RoutineLog[],
  today: string,
  days: number = 14,
  dayPlans: DayPlan[] = []
): RoutineInsightsReport {
  const activeRoutines = (routines || []).filter((r) => r.active !== false);

  if (activeRoutines.length === 0) {
    return {
      insights: [],
      hasInsights: false,
      calmSummaryText: 'Abhi koi active routine nahi hai.',
    };
  }

  const dayPlanMap = new Map<string, DayPlan>();
  for (const dp of dayPlans || []) {
    dayPlanMap.set(dp.planDate, dp);
  }

  const logMap = new Map<string, RoutineLog>();
  for (const l of logs || []) {
    logMap.set(`${l.routineId}_${l.logDate}`, l);
  }

  const items: RoutineInsightItem[] = [];

  for (const r of activeRoutines) {
    let applicableDays = 0;
    let doneCount = 0;

    for (let i = 1; i <= days; i++) {
      const curDate = addDays(today, -i);
      const dow = isoDow(curDate);

      // Check day of week
      if (r.daysOfWeek && !r.daysOfWeek.includes(dow)) {
        continue;
      }

      const dp = dayPlanMap.get(curDate);
      const isOff = dp?.isOff ?? false;
      const isMinDay = dp?.minimumDay ?? false;

      // Check appliesOn
      if (isOff && r.appliesOn === 'duty_days') {
        continue;
      }
      if (!isOff && r.appliesOn === 'off_days') {
        continue;
      }

      // Check minimum day
      if (isMinDay && !r.isMust) {
        continue;
      }

      applicableDays++;

      const log = logMap.get(`${r.id}_${curDate}`);
      if (log?.status === 'done') {
        doneCount++;
      } else if (
        (r.targetValue ?? 0) > 0 &&
        (log?.value ?? 0) >= (r.targetValue ?? 0)
      ) {
        doneCount++;
      }
    }

    const missedCount = Math.max(0, applicableDays - doneCount);
    const isInsufficientData = applicableDays < 3;
    const completionRatePercent =
      applicableDays > 0 ? Math.round((doneCount / applicableDays) * 100) : 0;

    let gentleSuggestionKey: RoutineInsightItem['gentleSuggestionKey'] = null;

    if (!isInsufficientData && missedCount >= 5) {
      if (r.block === 'morning') {
        gentleSuggestionKey = 'morning_shift_30m';
      } else if (r.block === 'duty') {
        gentleSuggestionKey = 'duty_anchor_ready';
      } else if (r.block === 'evening') {
        gentleSuggestionKey = 'evening_winddown';
      } else if ((r.targetValue ?? 0) > 0) {
        gentleSuggestionKey = 'water_reduce_step';
      } else {
        gentleSuggestionKey = 'simplify_or_reduce';
      }
    }

    items.push({
      routineId: r.id,
      title: r.title,
      block: r.block,
      doneCount,
      applicableDays,
      missedCount,
      completionRatePercent,
      mostCommonMissedWindow: r.block,
      gentleSuggestionKey,
      isInsufficientData,
    });
  }

  const allInsufficient = items.every((item) => item.isInsufficientData);
  const anySuggestion = items.some((item) => item.gentleSuggestionKey !== null);

  let calmSummaryText = 'Aapke routines ka rhythm shant aur steady chal raha hai.';
  if (allInsufficient) {
    calmSummaryText =
      'Abhi data kam hai — kuch din routine chalne ke baad aasan insights dikhenge.';
  } else if (anySuggestion) {
    calmSummaryText =
      'Yeh sujhaav routines ko aur aasaan banane ke liye hain — koi streak ya score penalty nahi hai.';
  }

  return {
    insights: items,
    hasInsights: !allInsufficient,
    calmSummaryText,
  };
}





