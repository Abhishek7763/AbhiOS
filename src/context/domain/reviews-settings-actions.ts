import React from 'react';
import { User } from 'firebase/auth';
import {
  AISuggestionDraft,
  AppStateData,
  DailyReview,
  ExportPayload,
  UserSettings,
  WeeklyReview,
} from '@/src/lib/types';
import { addDays } from '@/src/lib/logic/dates';
import { validateImportPayload } from '@/src/lib/logic/quality-gate';
import { STRINGS } from '@/src/lib/strings';
import { ToastMessage } from '@/src/context/types';

export interface ReviewsSettingsActionsDeps {
  state: AppStateData;
  setState: React.Dispatch<React.SetStateAction<AppStateData>>;
  today: string;
  user: User | null;
  accessDenied: boolean;
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
  setAiAvailable: React.Dispatch<React.SetStateAction<boolean>>;
}

export function buildReviewsSettingsActions({
  state,
  setState,
  today,
  user,
  accessDenied,
  showToast,
  setAiAvailable,
}: ReviewsSettingsActionsDeps) {
  const saveDailyReview = (fields: Partial<DailyReview>) => {
    setState((prev) => {
      const revDate = fields.reviewDate || today;
      const entry: DailyReview = {
        id: `${prev.settings.userId}_${revDate}`,
        userId: prev.settings.userId,
        reviewDate: revDate,
        completedText: fields.completedText || '',
        pendingText: fields.pendingText || '',
        surpriseText: fields.surpriseText || '',
        changeTomorrow: fields.changeTomorrow || '',
      };
      const others = prev.dailyReviews.filter((r) => r.reviewDate !== revDate);
      return {
        ...prev,
        dailyReviews: [...others, entry],
        settings: {
          ...prev.settings,
          lastActiveDate: today,
        },
      };
    });
    showToast('Daily Review save ho gaya. Shubh Raatri!', 'success');
  };

  const saveWeeklyReview = (fields: Partial<WeeklyReview>) => {
    setState((prev) => {
      const wk = fields.weekStart || today;
      const entry: WeeklyReview = {
        id: `${prev.settings.userId}_${wk}`,
        userId: prev.settings.userId,
        weekStart: wk,
        accomplishments: fields.accomplishments || '',
        challenges: fields.challenges || '',
        decisions: fields.decisions || '',
        nextPriorities: fields.nextPriorities || '',
      };
      const others = prev.weeklyReviews.filter((r) => r.weekStart !== wk);
      return {
        ...prev,
        weeklyReviews: [...others, entry],
      };
    });
    showToast('Weekly Review save ho gaya!', 'success');
  };

  const simulateGapDays = (days: number) => {
    const simulatedLastActive = addDays(today, -days);
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        lastActiveDate: simulatedLastActive,
      },
    }));
    showToast(
      `${days}-day gap simulate kiya gaya — Today screen par Fresh Start banner dekhein.`,
      'info'
    );
  };

  const performFreshStartCleanup = () => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => {
        if (
          (t.status === 'todo' || t.status === 'doing') &&
          t.dueDate &&
          t.dueDate < today
        ) {
          return {
            ...t,
            scheduledDate: null,
            dueDate: null,
            status: 'paused' as const,
            updatedAt: nowIso,
          };
        }
        return t;
      }),
      settings: {
        ...prev.settings,
        lastActiveDate: today,
      },
    }));
    showToast(
      'Wapas swagat! Purane overdue tasks pause ho gaye — aaj se fresh start.',
      'success'
    );
  };

  const updateSettings = (patch: Partial<UserSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...patch,
      },
    }));
    showToast('Settings update ho gayi.', 'success');
  };

  const exportBackupJson = (): ExportPayload => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        lastBackupAt: nowIso,
      },
    }));
    return {
      app: 'goal-os',
      version: 2,
      exported_at: nowIso,
      tables: {
        ...state,
        settings: {
          ...state.settings,
          lastBackupAt: nowIso,
        },
      },
    };
  };

  const importBackupJson = (
    rawJson: unknown,
    mode: 'merge' | 'replace-empty',
    onReplaceEmpty?: (tables: AppStateData) => void
  ): { ok: boolean; error?: string } => {
    const validation = validateImportPayload(rawJson);
    if (!validation.ok) {
      const err = validation.errors.join(' ');
      showToast(err, 'error');
      return { ok: false, error: err };
    }

    const payload = rawJson as ExportPayload;
    if (mode === 'replace-empty') {
      if (onReplaceEmpty) {
        onReplaceEmpty(payload.tables);
      }
      setState(payload.tables);
      if (user && !accessDenied) {
        void user.getIdToken().then((token) =>
          fetch('/api/state', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: 'import',
              mode: 'replace',
              payload,
            }),
          }).catch(() => {})
        );
      }
      showToast('Backup successfully restore ho gaya!', 'success');
      return { ok: true };
    }

    // Merge by id
    setState((prev) => {
      const mergeById = <T extends { id: string }>(
        existing: T[],
        incoming: T[] = []
      ): T[] => {
        const map = new Map<string, T>();
        existing.forEach((item) => map.set(item.id, item));
        incoming.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
      };

      return {
        settings: { ...prev.settings, ...(payload.tables.settings || {}) },
        lifeAreas: mergeById(prev.lifeAreas, payload.tables.lifeAreas),
        inboxItems: mergeById(prev.inboxItems, payload.tables.inboxItems),
        inboxLinks: mergeById(prev.inboxLinks, payload.tables.inboxLinks),
        goals: mergeById(prev.goals, payload.tables.goals),
        projects: mergeById(prev.projects, payload.tables.projects),
        milestones: mergeById(prev.milestones, payload.tables.milestones),
        tasks: mergeById(prev.tasks, payload.tables.tasks),
        dayPlans: mergeById(prev.dayPlans, payload.tables.dayPlans),
        routines: mergeById(prev.routines, payload.tables.routines),
        routineLogs: mergeById(prev.routineLogs, payload.tables.routineLogs),
        dailyReviews: mergeById(
          prev.dailyReviews,
          payload.tables.dailyReviews
        ),
        weeklyReviews: mergeById(
          prev.weeklyReviews,
          payload.tables.weeklyReviews
        ),
        reminderSent: mergeById(
          prev.reminderSent,
          payload.tables.reminderSent
        ),
      };
    });

    if (user && !accessDenied) {
      void user.getIdToken().then((token) =>
        fetch('/api/state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'import',
            mode: 'merge',
            payload,
          }),
        }).catch(() => {})
      );
    }

    showToast('Backup data merge ho gaya!', 'success');
    return { ok: true };
  };

  const requestAiSuggestion = async (
    mode:
      | 'inbox_clarify'
      | 'goal_gate_assist'
      | 'goal_breakdown'
      | 'task_split',
    text: string,
    context?: Record<string, unknown>
  ): Promise<{ aiUsed: boolean; draft: AISuggestionDraft }> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (user) {
      try {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      } catch {}
    }

    const res = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode, text, context }),
    });
    const data = await res.json().catch(() => ({}));
    if (typeof data.aiAvailable === 'boolean') {
      setAiAvailable(data.aiAvailable);
    }
    if (
      !data.aiUsed &&
      typeof data.reason === 'string' &&
      data.reason !== 'no_key'
    ) {
      showToast(STRINGS.inbox.aiFallbackNotice(data.reason), 'info');
    }
    return {
      aiUsed: Boolean(data.aiUsed),
      draft: data.draft || {},
    };
  };

  return {
    saveDailyReview,
    saveWeeklyReview,
    simulateGapDays,
    performFreshStartCleanup,
    updateSettings,
    exportBackupJson,
    importBackupJson,
    requestAiSuggestion,
  };
}
