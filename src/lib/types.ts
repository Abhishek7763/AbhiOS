export type InboxStatus =
  | 'new'
  | 'processing'
  | 'waiting'
  | 'processed'
  | 'someday'
  | 'archived'
  | 'trash';

export type InboxItemType =
  | 'unknown'
  | 'task'
  | 'goal_candidate'
  | 'project'
  | 'habit_candidate'
  | 'reference'
  | 'idea'
  | 'concern'
  | 'waiting_for'
  | 'duplicate';

export type GoalStatus =
  | 'candidate'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type GoalType = 'outcome' | 'ongoing_direction';

export type TaskStatus = 'todo' | 'doing' | 'done' | 'paused' | 'cancelled';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export type RoutineBlock = 'morning' | 'duty' | 'evening' | 'anytime';
export type RoutineAnchorType = 'clock' | 'wake' | 'duty_start';
export type RoutineAppliesOn = 'all' | 'duty_days' | 'off_days';

export interface WaterCheckpoint {
  at: string; // 'HH:MM'
  min: number; // e.g. 750
}

export interface UserSettings {
  userId: string;
  timezone: string;
  wakeTime: string;
  quietStart: string;
  quietEnd: string;
  dayRolloverHour: number;
  dailyWorkloadMinutes: number;
  dutyPromptTime: string;
  reviewTime: string;
  maxRemindersPerDay: number;
  pushEnabled: boolean;
  lastActiveDate?: string | null;
  lastBackupAt?: string | null;
  updatedAt?: string;
}

export interface LifeArea {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: 'active' | 'archived';
  sortOrder: number;
  updatedAt?: string;
}

export interface AISuggestionDraft {
  suggestedType?: InboxItemType;
  refinedTitle?: string;
  nextAction?: string;
  estMinutes?: number;
  purposeReason?: string;
  tradeoffs?: string;
  subItems?: string[];
  explanation?: string;
}

export interface InboxItem {
  id: string;
  userId: string;
  content: string;
  status: InboxStatus;
  itemType: InboxItemType;
  source: 'manual' | 'quick_capture' | 'split';
  lifeAreaId?: string | null;
  tags?: string[];
  decisionNote?: string | null;
  linkedEntityType?:
    | 'task'
    | 'goal'
    | 'project'
    | 'routine'
    | 'split_multiple'
    | null;
  linkedEntityId?: string | null;
  aiSuggestionJson?: AISuggestionDraft | null;
  processedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InboxLink {
  id: string;
  userId: string;
  inboxItemId: string;
  targetType: 'task' | 'goal' | 'project' | 'routine' | 'inbox_item';
  targetId: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  lifeAreaId: string;
  title: string;
  desiredOutcome?: string | null;
  purposeReason?: string | null;
  ownershipReflection?: string | null;
  evidenceOfProgress?: string | null;
  controlNotes?: string | null;
  tradeoffs?: string | null;
  capacityNotes?: string | null;
  tags?: string[];
  goalType: GoalType;
  status: GoalStatus;
  targetDate?: string | null;
  reviewDate?: string | null;
  reviewCadence?: 'weekly' | 'biweekly' | 'monthly' | null;
  originInboxItemId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  goalId?: string | null;
  lifeAreaId?: string | null;
  title: string;
  description?: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  originInboxItemId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  description?: string | null;
  status: 'todo' | 'doing' | 'done' | 'dropped';
  seq: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  goalId?: string | null;
  milestoneId?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  originInboxItemId?: string | null;
  title: string;
  nextAction?: string | null;
  status: TaskStatus;
  estMinutes?: number | null;
  dueDate?: string | null;
  scheduledDate?: string | null;
  recurrence?: TaskRecurrence | null;
  rescheduleCount: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlan {
  id: string;
  userId: string;
  planDate: string;
  isOff: boolean;
  dutyStart?: string | null;
  minimumDay: boolean;
  mainTaskId?: string | null;
  locked: boolean;
  updatedAt?: string;
}

export interface Routine {
  id: string;
  userId: string;
  goalId?: string | null;
  originInboxItemId?: string | null;
  title: string;
  block: RoutineBlock;
  anchorType: RoutineAnchorType;
  clockTime?: string | null;
  anchorOffsetMin: number;
  appliesOn: RoutineAppliesOn;
  daysOfWeek: number[];
  isMust: boolean;
  targetValue?: number | null;
  stepValue?: number | null;
  unit?: string | null;
  checkpoints?: WaterCheckpoint[] | null;
  active: boolean;
  sortOrder: number;
  updatedAt?: string;
}

export interface RoutineLog {
  id: string;
  userId: string;
  routineId: string;
  logDate: string;
  status: 'partial' | 'done' | 'skipped';
  value: number;
  completedAt?: string | null;
  updatedAt?: string;
}

export interface DailyReview {
  id: string;
  userId: string;
  reviewDate: string;
  completedText?: string | null;
  pendingText?: string | null;
  surpriseText?: string | null;
  changeTomorrow?: string | null;
  updatedAt?: string;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: string;
  accomplishments?: string | null;
  challenges?: string | null;
  decisions?: string | null;
  nextPriorities?: string | null;
  updatedAt?: string;
}

export interface ReminderSentRecord {
  id: string;
  userId: string;
  logDate: string;
  itemKey: string;
  nudgeNo: number;
  batchId: string;
  sentAt: string;
}

export interface AppStateData {
  settings: UserSettings;
  lifeAreas: LifeArea[];
  inboxItems: InboxItem[];
  inboxLinks: InboxLink[];
  goals: Goal[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  dayPlans: DayPlan[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  dailyReviews: DailyReview[];
  weeklyReviews: WeeklyReview[];
  reminderSent: ReminderSentRecord[];
}

export interface ExportPayload {
  app: 'goal-os';
  version: number;
  exported_at: string;
  tables: AppStateData;
}
