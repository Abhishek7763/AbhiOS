import { User } from 'firebase/auth';
import {
  AISuggestionDraft,
  AppStateData,
  DailyReview,
  DayPlan,
  ExportPayload,
  Goal,
  InboxItem,
  LifeArea,
  Milestone,
  Project,
  Routine,
  Task,
  UserSettings,
  WeeklyReview,
} from '@/src/lib/types';

export type NavTab = 'today' | 'inbox' | 'tasks' | 'goals' | 'settings';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  authProvider: 'firebase' | 'supabase' | 'password' | 'pin';
  getIdToken?: () => Promise<string>;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'warning' | 'error';
  undoAction?: () => void;
}

export interface GoalOsContextValue {
  state: AppStateData;
  today: string;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: AuthUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  accessDenied: boolean;
  cloudSynced: boolean;
  pendingSyncCount: number;
  aiAvailable: boolean;
  darkMode: boolean;
  toggleDarkMode: () => void;
  toasts: ToastMessage[];
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
  dismissToast: (id: string) => void;
  // Auth
  loginWithCredentials: (
    idOrEmail: string,
    pass: string,
    rememberMe?: boolean,
    delayCommitMs?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithPin: (
    pin: string,
    rememberMe?: boolean,
    delayCommitMs?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogle: () => Promise<void>;
  logoutUser: () => Promise<void>;
  syncWithSupabaseNow: () => Promise<boolean>;
  supabaseConfigured: boolean;
  // Quick Capture & Inbox
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
  quickCaptureInitialText: string;
  setQuickCaptureInitialText: (text: string) => void;
  openQuickCaptureWithPrefill: (text: string) => void;
  quickCapture: (
    content: string,
    source?: InboxItem['source'],
    options?: {
      lifeAreaId?: string | null;
      tags?: string[];
      status?: InboxItem['status'];
      decisionNote?: string;
    }
  ) => InboxItem | null;
  updateInboxItem: (id: string, patch: Partial<InboxItem>) => void;
  restoreInboxItem: (id: string) => void;
  splitInboxItem: (id: string, subContents: string[]) => void;
  mergeInboxItems: (primaryId: string, duplicateId: string) => void;
  convertInboxToEntity: (
    inboxId: string,
    targetType: 'task' | 'goal_candidate' | 'project' | 'routine',
    fields: Record<string, unknown>
  ) => string;
  moveInboxToExistingGoal: (
    inboxId: string,
    goalId: string,
    stepType?: 'milestone' | 'task',
    customTitle?: string
  ) => string;
  captureAndMoveToGoal: (
    content: string,
    goalId: string,
    stepType?: 'milestone' | 'task'
  ) => string | null;
  // Goal Quality Gate & Goals
  activeQualityGateGoalId: string | null;
  setActiveQualityGateGoalId: (id: string | null) => void;
  createGoalCandidate: (fields: Partial<Goal>) => Goal;
  createDirectGoal: (fields: Partial<Goal>) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  resolveGoalCandidateGate: (
    goalId: string,
    decision:
      | 'accept'
      | 'refine'
      | 'convert_project'
      | 'convert_task'
      | 'convert_habit'
      | 'someday'
      | 'reference'
      | 'decline',
    patch: Partial<Goal>,
    firstNextActionTitle?: string
  ) => void;
  createProject: (fields: Partial<Project>) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  createMilestone: (fields: Partial<Milestone>) => Milestone;
  updateMilestone: (id: string, patch: Partial<Milestone>) => void;
  reorderMilestone: (milestoneId: string, direction: 'up' | 'down') => void;
  createLifeArea: (name: string, description?: string) => LifeArea | null;
  updateLifeArea: (id: string, patch: Partial<LifeArea>) => void;
  archiveLifeArea: (id: string) => void;
  // Tasks
  createTask: (fields: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  rescheduleTask: (id: string, newDate: string) => void;
  splitTaskIntoSubtasks: (id: string, subTitles: string[]) => void;
  // Today, DayPlan, Routines & Water
  todayPlan: DayPlan;
  upsertTodayPlan: (patch: Partial<DayPlan>) => void;
  bulkUpsertDayPlans: (plans: DayPlan[]) => void;
  toggleRoutineDone: (routineId: string) => void;
  skipRoutineToday: (routineId: string) => void;
  addWater: (routineId: string, deltaMl: number) => void;
  createRoutine: (fields: Partial<Routine>) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  reorderRoutine: (id: string, direction: 'up' | 'down') => void;
  // Reviews & Re-entry
  saveDailyReview: (fields: Partial<DailyReview>) => void;
  saveWeeklyReview: (fields: Partial<WeeklyReview>) => void;
  simulateGapDays: (days: number) => void;
  performFreshStartCleanup: () => void;
  // Settings, Backup & AI
  updateSettings: (patch: Partial<UserSettings>) => void;
  exportBackupJson: () => ExportPayload;
  importBackupJson: (
    rawJson: unknown,
    mode: 'merge' | 'replace-empty'
  ) => { ok: boolean; error?: string };
  requestAiSuggestion: (
    mode:
      | 'inbox_clarify'
      | 'goal_gate_assist'
      | 'goal_breakdown'
      | 'task_split',
    text: string,
    context?: Record<string, unknown>
  ) => Promise<{
    aiUsed: boolean;
    reason?: 'quota' | 'model_error' | 'no_key' | 'timeout';
    draft: AISuggestionDraft;
  }>;
}
