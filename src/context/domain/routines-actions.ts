import React from 'react';
import { AppStateData, DayPlan, Routine } from '@/src/lib/types';
import { applyWaterDelta } from '@/src/lib/logic/planner';
import { STRINGS } from '@/src/lib/strings';
import { ToastMessage } from '@/src/context/types';
import { makeId } from './helpers';

export interface RoutinesActionsDeps {
  state: AppStateData;
  setState: React.Dispatch<React.SetStateAction<AppStateData>>;
  today: string;
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
}

export function buildRoutinesActions({
  state,
  setState,
  today,
  showToast,
}: RoutinesActionsDeps) {
  const upsertTodayPlan = (patch: Partial<DayPlan>) => {
    setState((prev) => {
      const existing = prev.dayPlans.find((dp) => dp.planDate === today);
      const updated: DayPlan = existing
        ? { ...existing, ...patch }
        : {
            id: `${prev.settings.userId}_${today}`,
            userId: prev.settings.userId,
            planDate: today,
            isOff: false,
            dutyStart: '08:30',
            minimumDay: false,
            mainTaskId: null,
            locked: false,
            ...patch,
          };

      const others = prev.dayPlans.filter((dp) => dp.planDate !== today);
      return {
        ...prev,
        dayPlans: [...others, updated],
      };
    });
  };

  const bulkUpsertDayPlans = (plans: DayPlan[]) => {
    if (!plans || plans.length === 0) return;
    setState((prev) => {
      const plansMap = new Map<string, DayPlan>();
      for (const dp of prev.dayPlans) {
        plansMap.set(dp.planDate, dp);
      }
      for (const p of plans) {
        if (!p.planDate) continue;
        plansMap.set(p.planDate, p);
      }
      return {
        ...prev,
        dayPlans: Array.from(plansMap.values()),
      };
    });
    showToast(STRINGS.roster.savedToast, 'success');
  };

  const toggleRoutineDone = (routineId: string) => {
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const existing = prev.routineLogs.find(
        (l) => l.routineId === routineId && l.logDate === today
      );
      if (existing && existing.status === 'done') {
        return {
          ...prev,
          routineLogs: prev.routineLogs.filter((l) => l.id !== existing.id),
        };
      }
      const newLog = {
        id: existing?.id || `${routineId}_${today}`,
        userId: prev.settings.userId,
        routineId,
        logDate: today,
        status: 'done' as const,
        value: existing?.value || 1,
        completedAt: nowIso,
      };
      const others = prev.routineLogs.filter(
        (l) => !(l.routineId === routineId && l.logDate === today)
      );
      return {
        ...prev,
        routineLogs: [...others, newLog],
      };
    });
  };

  const skipRoutineToday = (routineId: string) => {
    setState((prev) => {
      const others = prev.routineLogs.filter(
        (l) => !(l.routineId === routineId && l.logDate === today)
      );
      return {
        ...prev,
        routineLogs: [
          ...others,
          {
            id: `${routineId}_${today}`,
            userId: prev.settings.userId,
            routineId,
            logDate: today,
            status: 'skipped' as const,
            value: 0,
            completedAt: null,
          },
        ],
      };
    });
    showToast('Routine aaj ke liye skip kiya gaya (no guilt).', 'info');
  };

  const addWater = (routineId: string, deltaMl: number) => {
    setState((prev) => {
      const routine = prev.routines.find((r) => r.id === routineId);
      if (!routine) return prev;
      const currentLog = prev.routineLogs.find(
        (l) => l.routineId === routineId && l.logDate === today
      );
      const updatedLog = applyWaterDelta(
        currentLog,
        routine,
        deltaMl,
        today,
        prev.settings.userId
      );
      const others = prev.routineLogs.filter(
        (l) => !(l.routineId === routineId && l.logDate === today)
      );
      return {
        ...prev,
        routineLogs: updatedLog ? [...others, updatedLog] : others,
      };
    });
  };

  const createRoutine = (fields: Partial<Routine>) => {
    const newRoutine: Routine = {
      id: makeId('rt'),
      userId: state.settings.userId,
      goalId: fields.goalId || null,
      title: (fields.title || 'Naya Routine').trim(),
      block: fields.block || 'morning',
      anchorType: fields.anchorType || 'clock',
      clockTime: fields.clockTime || '07:00',
      anchorOffsetMin: fields.anchorOffsetMin ?? 0,
      appliesOn: fields.appliesOn || 'all',
      daysOfWeek: fields.daysOfWeek || [1, 2, 3, 4, 5, 6, 7],
      isMust: Boolean(fields.isMust),
      targetValue: fields.targetValue ?? null,
      stepValue: fields.stepValue ?? null,
      unit: fields.unit || null,
      checkpoints: fields.checkpoints || null,
      active: true,
      sortOrder: state.routines.length + 1,
    };
    setState((prev) => ({
      ...prev,
      routines: [...prev.routines, newRoutine],
    }));
    showToast('Routine save ho gaya.', 'success');
  };

  const updateRoutine = (id: string, patch: Partial<Routine>) => {
    setState((prev) => ({
      ...prev,
      routines: prev.routines.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    }));
  };

  const reorderRoutine = (id: string, direction: 'up' | 'down') => {
    setState((prev) => {
      const sorted = [...prev.routines].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      const idx = sorted.findIndex((r) => r.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[swapIdx];
      sorted[swapIdx] = temp;
      return {
        ...prev,
        routines: sorted.map((r, i) => ({ ...r, sortOrder: i + 1 })),
      };
    });
  };

  return {
    upsertTodayPlan,
    bulkUpsertDayPlans,
    toggleRoutineDone,
    skipRoutineToday,
    addWater,
    createRoutine,
    updateRoutine,
    reorderRoutine,
  };
}
