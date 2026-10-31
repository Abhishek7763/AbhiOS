'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { STRINGS } from '@/src/lib/strings';
import { addDays } from '@/src/lib/logic/dates';
import {
  computeTodayMomentum,
  filterRoutinesForToday,
  generateTwoMinuteStarter,
  suggestDayTasks,
  suggestMainPriority,
} from '@/src/lib/logic/planner';
import {
  computeNeedsAttention,
  shouldShowReEntry,
} from '@/src/lib/logic/attention';
import { Task } from '@/src/lib/types';
import { playCompletionCelebrationSound } from '@/src/components/animated-check-button';
import { WeeklyDutyRosterSheet } from '@/src/components/weekly-duty-roster-sheet';

import { TodayHeader } from '@/src/components/today/today-header';
import { TodayNeedsAttention } from '@/src/components/today/today-needs-attention';
import { TodayMainPriority } from '@/src/components/today/today-main-priority';
import { TodayTasksSection } from '@/src/components/today/today-tasks-section';
import { TodayWaterCard } from '@/src/components/today/today-water-card';
import { TodayRoutinesSection } from '@/src/components/today/today-routines-section';
import { TodayReviewModals } from '@/src/components/today/today-review-modals';

export function TodayView() {
  const {
    state,
    today,
    todayPlan,
    upsertTodayPlan,
    toggleRoutineDone,
    skipRoutineToday,
    addWater,
    completeTask,
    reopenTask,
    rescheduleTask,
    splitTaskIntoSubtasks,
    updateTask,
    saveDailyReview,
    saveWeeklyReview,
    performFreshStartCleanup,
    setActiveTab,
    setActiveQualityGateGoalId,
  } = useGoalOs();

  const [showAttentionSheet, setShowAttentionSheet] = useState(false);
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [splittingTaskId, setSplittingTaskId] = useState<string | null>(null);
  const [splitLinesText, setSplitLinesText] = useState('');
  const [showShiftPresets, setShowShiftPresets] = useState(false);
  const [showDutyRoster, setShowDutyRoster] = useState(false);
  const [expandedTaskMenuId, setExpandedTaskMenuId] = useState<string | null>(
    null
  );
  const [showCompletedToday, setShowCompletedToday] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [collapsedBlocks, setCollapsedBlocks] = useState<
    Record<string, boolean>
  >({});

  // Celebration state
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Record<string, boolean>>(
    {}
  );
  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(
    null
  );

  const triggerTickCelebration = (id: string, title: string) => {
    playCompletionCelebrationSound();
    setCelebratingId(id);
    setCelebrationBanner(`✓ "${title}" pura ho gaya! Shabaash!`);
    window.setTimeout(() => {
      setCelebratingId((prev) => (prev === id ? null : prev));
    }, 950);
    window.setTimeout(() => {
      setCelebrationBanner((prev) =>
        prev?.includes(title) ? null : prev
      );
    }, 2800);
  };

  const handleTickTaskWithDelight = (task: Task) => {
    if (task.status === 'done') {
      reopenTask(task.id);
      return;
    }
    if (completingIds[task.id]) return;

    setCompletingIds((prev) => ({ ...prev, [task.id]: true }));
    triggerTickCelebration(task.id, task.title);

    window.setTimeout(() => {
      completeTask(task.id);
      setCompletingIds((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }, 480);
  };

  const handleTickRoutineWithDelight = (
    routineId: string,
    title: string,
    isDoneCurrently: boolean
  ) => {
    if (!isDoneCurrently) {
      triggerTickCelebration(routineId, title);
    }
    toggleRoutineDone(routineId);
  };

  // Focus Timer State
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusRemainingSec, setFocusRemainingSec] = useState<number>(25 * 60);
  const [focusTotalSec, setFocusTotalSec] = useState<number>(25 * 60);
  const [focusRunning, setFocusRunning] = useState<boolean>(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (focusRunning && focusRemainingSec > 0) {
      timer = setInterval(() => {
        setFocusRemainingSec((prev) => {
          if (prev <= 1) {
            setFocusRunning(false);
            playCompletionCelebrationSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [focusRunning, focusRemainingSec]);

  const startFocusOnTask = (task: Task) => {
    const defaultMins = task.estMinutes ?? 25;
    const initialSec = defaultMins * 60;
    setFocusTaskId(task.id);
    setFocusTotalSec(initialSec);
    setFocusRemainingSec(initialSec);
    setFocusRunning(true);
  };

  const activeGoalIds = useMemo(
    () =>
      new Set(
        state.goals.filter((g) => g.status === 'active').map((g) => g.id)
      ),
    [state.goals]
  );

  const attention = useMemo(
    () =>
      computeNeedsAttention({
        tasks: state.tasks,
        goals: state.goals,
        inboxItems: state.inboxItems,
        today,
      }),
    [state.tasks, state.goals, state.inboxItems, today]
  );

  const showReEntryBanner = useMemo(
    () => shouldShowReEntry(state.settings.lastActiveDate, today),
    [state.settings.lastActiveDate, today]
  );

  const dayPlanRecommendations = useMemo(
    () =>
      suggestDayTasks(
        state.tasks,
        state.settings.dailyWorkloadMinutes,
        today,
        activeGoalIds
      ),
    [
      state.tasks,
      state.settings.dailyWorkloadMinutes,
      today,
      activeGoalIds,
    ]
  );

  const mainPriorityTask = useMemo(() => {
    if (todayPlan.mainTaskId) {
      const explicit = state.tasks.find(
        (t) => t.id === todayPlan.mainTaskId && t.status !== 'cancelled'
      );
      if (explicit) return explicit;
    }
    return dayPlanRecommendations.mainTask;
  }, [todayPlan.mainTaskId, state.tasks, dayPlanRecommendations.mainTask]);

  const todayTasks = useMemo(() => {
    const allDueOrScheduled = state.tasks.filter((t) => {
      if (t.status === 'done' || t.status === 'cancelled') return false;
      return t.scheduledDate === today || (t.dueDate && t.dueDate <= today);
    });

    if (todayPlan.minimumDay) {
      const list: Task[] = [];
      if (mainPriorityTask && mainPriorityTask.status !== 'done') {
        list.push(mainPriorityTask);
      }
      const secondary = allDueOrScheduled.find(
        (t) => t.id !== mainPriorityTask?.id
      );
      if (secondary) list.push(secondary);
      return list;
    }
    return allDueOrScheduled;
  }, [state.tasks, today, todayPlan.minimumDay, mainPriorityTask]);

  const completedTodayTasks = useMemo(
    () =>
      state.tasks.filter(
        (t) =>
          t.status === 'done' &&
          (t.scheduledDate === today ||
            t.dueDate === today ||
            (t.completedAt && t.completedAt.startsWith(today)))
      ),
    [state.tasks, today]
  );

  const todayRoutines = useMemo(
    () => filterRoutinesForToday(state.routines, today, todayPlan),
    [state.routines, today, todayPlan]
  );

  const waterRoutine = useMemo(
    () =>
      todayRoutines.find((r) => (r.targetValue ?? 0) > 0 && r.unit === 'ml') ||
      state.routines.find((r) => (r.targetValue ?? 0) > 0 && r.unit === 'ml'),
    [todayRoutines, state.routines]
  );

  const booleanRoutines = useMemo(
    () => todayRoutines.filter((r) => r.id !== waterRoutine?.id),
    [todayRoutines, waterRoutine]
  );

  const routineLogs = state.routineLogs;
  const logByRoutineId = useMemo(() => {
    const map = new Map<string, (typeof routineLogs)[number]>();
    for (const l of routineLogs) {
      if (l.logDate === today) {
        map.set(l.routineId, l);
      }
    }
    return map;
  }, [routineLogs, today]);

  const waterLog = waterRoutine ? logByRoutineId.get(waterRoutine.id) : null;
  const waterValue = waterLog?.value ?? 0;
  const waterTarget = waterRoutine?.targetValue ?? 2500;
  const waterPercent = Math.min(
    100,
    Math.round((waterValue / waterTarget) * 100)
  );

  const completedRoutinesCount = useMemo(
    () =>
      booleanRoutines.filter(
        (r) => logByRoutineId.get(r.id)?.status === 'done'
      ).length,
    [booleanRoutines, logByRoutineId]
  );

  const momentum = useMemo(
    () =>
      computeTodayMomentum({
        todayCompletedCount: completedTodayTasks.length,
        todayPendingCount: todayTasks.length,
        routinesDoneCount: completedRoutinesCount,
        routinesTotalCount: booleanRoutines.length,
      }),
    [
      completedTodayTasks.length,
      todayTasks.length,
      completedRoutinesCount,
      booleanRoutines.length,
    ]
  );

  const totalScheduledMinutes = useMemo(
    () =>
      todayTasks.reduce((sum, t) => sum + (t.estMinutes ?? 25), 0),
    [todayTasks]
  );

  return (
    <div className="space-y-6">
      {/* 1. Today Context Strip Header */}
      <TodayHeader
        today={today}
        todayPlan={todayPlan}
        onUpdateDayPlan={upsertTodayPlan}
        showShiftPresets={showShiftPresets}
        onToggleShiftPresets={() => setShowShiftPresets((v) => !v)}
        onOpenDutyRoster={() => setShowDutyRoster(true)}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode((v) => !v)}
        completedTasksCount={completedTodayTasks.length}
        completedRoutinesCount={completedRoutinesCount}
        momentum={momentum}
        celebrationBanner={celebrationBanner}
      />

      {/* 2. Gap Re-Entry Banner */}
      {showReEntryBanner && (
        <section className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-amber-950 dark:text-amber-100">
              {STRINGS.today.reEntryTitle}
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
              {STRINGS.today.reEntrySubtitle}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={performFreshStartCleanup}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold whitespace-nowrap"
            >
              {STRINGS.today.reEntryCleanBtn(
                attention.overdueTasks.length + attention.staleTasks.length
              )}
            </button>
          </div>
        </section>
      )}

      {/* 3. Needs Attention Banner */}
      <TodayNeedsAttention
        attention={attention}
        showAttentionSheet={showAttentionSheet}
        onToggleSheet={() => setShowAttentionSheet((v) => !v)}
        onReschedule={(taskId, targetDate) =>
          rescheduleTask(
            taskId,
            targetDate === 'tomorrow' ? addDays(today, 1) : targetDate
          )
        }
        onOpenSplit={(task) => {
          setSplittingTaskId(task.id);
          setSplitLinesText(`${task.title} - Step 1\n${task.title} - Step 2`);
        }}
        onCancelTask={(taskId) => updateTask(taskId, { status: 'cancelled' })}
        onOpenInboxTab={() => setActiveTab('inbox')}
        today={today}
      />

      {/* Main 2-Column Responsive Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Main Priority + Today's Tasks */}
        <div className="lg:col-span-7 space-y-6">
          {/* 4. Main Priority Card */}
          <TodayMainPriority
            mainPriorityTask={mainPriorityTask}
            isMinimumDay={todayPlan.minimumDay}
            celebratingId={celebratingId}
            completingIds={completingIds}
            goalTitle={
              mainPriorityTask?.goalId
                ? state.goals.find((g) => g.id === mainPriorityTask.goalId)?.title || null
                : null
            }
            onAutoSuggest={() => {
              const best = suggestMainPriority(state.tasks, today, activeGoalIds);
              if (best) upsertTodayPlan({ mainTaskId: best.id });
            }}
            onCompleteTask={handleTickTaskWithDelight}
            focusTaskId={focusTaskId}
            focusRunning={focusRunning}
            focusRemainingSec={focusRemainingSec}
            focusTotalSec={focusTotalSec}
            onStartFocus={startFocusOnTask}
            onToggleFocusRunning={() => setFocusRunning((r) => !r)}
            onSetFocusDuration={(m) => {
              setFocusTotalSec(m * 60);
              setFocusRemainingSec(m * 60);
            }}
            onAddFocusMinutes={(m) => {
              setFocusTotalSec((t) => t + m * 60);
              setFocusRemainingSec((r) => r + m * 60);
            }}
            onCloseFocus={() => {
              setFocusRunning(false);
              setFocusTaskId(null);
            }}
            onDoneFocus={(task) => {
              if (task) {
                handleTickTaskWithDelight(task);
              } else if (focusTaskId) {
                completeTask(focusTaskId);
              }
              setFocusRunning(false);
              setFocusTaskId(null);
            }}
          />

          {/* 5. Today's Tasks Section (Hidden when Zen Focus Mode is active) */}
          {!zenMode && (
            <TodayTasksSection
              todayTasks={todayTasks}
              completedTodayTasks={completedTodayTasks}
              mainPriorityTaskId={mainPriorityTask?.id}
              totalScheduledMinutes={totalScheduledMinutes}
              budgetMinutes={dayPlanRecommendations.budgetMinutes}
              allTasksCount={state.tasks.filter((t) => t.status === 'todo').length}
              goals={state.goals}
              celebratingId={celebratingId}
              completingIds={completingIds}
              expandedTaskMenuId={expandedTaskMenuId}
              showCompletedToday={showCompletedToday}
              onToggleShowCompletedToday={() => setShowCompletedToday((v) => !v)}
              onOpenTasksTab={() => setActiveTab('tasks')}
              onToggleTaskDone={handleTickTaskWithDelight}
              onReopenTask={reopenTask}
              onStartFocus={startFocusOnTask}
              onToggleMenu={(id) =>
                setExpandedTaskMenuId(expandedTaskMenuId === id ? null : id)
              }
              onMakeMainPriority={(id) => {
                upsertTodayPlan({ mainTaskId: id });
                setExpandedTaskMenuId(null);
              }}
              onRescheduleTomorrow={(id) => {
                rescheduleTask(id, addDays(today, 1));
                setExpandedTaskMenuId(null);
              }}
              onTwoMinuteStarter={(task) => {
                splitTaskIntoSubtasks(
                  task.id,
                  generateTwoMinuteStarter(task.title, task.nextAction)
                );
                setExpandedTaskMenuId(null);
              }}
              onOpenSplit={(task) => {
                setExpandedTaskMenuId(null);
                setSplittingTaskId(task.id);
                setSplitLinesText(
                  `${task.title} - Part 1\n${task.title} - Part 2`
                );
              }}
            />
          )}
        </div>

        {/* Right Column (5 cols): Water Card + Daily Routines + Reviews */}
        <div className="lg:col-span-5 space-y-6">
          {/* 6. Water Card */}
          {waterRoutine && (
            <TodayWaterCard
              waterRoutine={waterRoutine}
              waterValue={waterValue}
              waterTarget={waterTarget}
              waterPercent={waterPercent}
              onAddWater={(delta) => addWater(waterRoutine.id, delta)}
            />
          )}

          {/* 7. Routines Section (Hidden when Zen Focus Mode is active) */}
          {!zenMode && (
            <TodayRoutinesSection
              booleanRoutines={booleanRoutines}
              logByRoutineId={logByRoutineId}
              completedRoutinesCount={completedRoutinesCount}
              settings={state.settings}
              todayPlan={todayPlan}
              celebratingId={celebratingId}
              collapsedBlocks={collapsedBlocks}
              onToggleBlockCollapse={(key) =>
                setCollapsedBlocks((prev) => ({
                  ...prev,
                  [key]: !prev[key],
                }))
              }
              onTickRoutine={handleTickRoutineWithDelight}
              onSkipRoutine={skipRoutineToday}
            />
          )}

          {/* 8. Evening Review Triggers */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Review & Adjust (No Guilt)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reviews plan ko adjust karte hain, aapki worth ko nahi.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowDailyReview(true)}
                className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {STRINGS.today.dailyReviewBtn}
              </button>
              <button
                type="button"
                onClick={() => setShowWeeklyReview(true)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2"
              >
                {STRINGS.today.weeklyReviewBtn}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Review & Split Modals */}
      <TodayReviewModals
        today={today}
        splittingTaskId={splittingTaskId}
        splitLinesText={splitLinesText}
        onChangeSplitLinesText={setSplitLinesText}
        onCloseSplit={() => setSplittingTaskId(null)}
        onSubmitSplit={(taskId, lines) => {
          splitTaskIntoSubtasks(taskId, lines);
          setSplittingTaskId(null);
        }}
        showDailyReview={showDailyReview}
        onCloseDailyReview={() => setShowDailyReview(false)}
        onSaveDailyReview={saveDailyReview}
        todayTasks={todayTasks}
        completedTodayTasksCount={completedTodayTasks.length}
        waterValue={waterValue}
        booleanRoutinesCount={booleanRoutines.length}
        completedRoutinesCount={completedRoutinesCount}
        onRescheduleTaskTomorrow={(id) => rescheduleTask(id, addDays(today, 1))}
        onOpenSplitFromDailyReview={(task) => {
          setShowDailyReview(false);
          setSplittingTaskId(task.id);
          setSplitLinesText(`${task.title} - Step 1\n${task.title} - Step 2`);
        }}
        onCancelTaskFromDailyReview={(id) => updateTask(id, { status: 'cancelled' })}
        showWeeklyReview={showWeeklyReview}
        onCloseWeeklyReview={() => setShowWeeklyReview(false)}
        onSaveWeeklyReview={saveWeeklyReview}
        activeGoals={state.goals.filter((g) => g.status === 'active')}
        routines={state.routines}
        routineLogs={state.routineLogs}
        dayPlans={state.dayPlans}
        onOpenQualityGate={(id) => {
          setShowWeeklyReview(false);
          setActiveQualityGateGoalId(id);
        }}
      />

      {/* Weekly Duty Roster Sheet */}
      <WeeklyDutyRosterSheet
        open={showDutyRoster}
        onClose={() => setShowDutyRoster(false)}
      />
    </div>
  );
}
