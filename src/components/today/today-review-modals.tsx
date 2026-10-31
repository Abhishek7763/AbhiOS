'use client';

import React, { useState } from 'react';
import { STRINGS } from '@/src/lib/strings';
import { Goal, Routine, RoutineLog, Task, DayPlan, DailyReview, WeeklyReview } from '@/src/lib/types';
import { weekStartMonday } from '@/src/lib/logic/dates';
import { RoutineInsightsCard } from '@/src/components/routine-insights-card';

interface TodayReviewModalsProps {
  today: string;
  // Split modal props
  splittingTaskId: string | null;
  splitLinesText: string;
  onChangeSplitLinesText: (val: string) => void;
  onCloseSplit: () => void;
  onSubmitSplit: (taskId: string, lines: string[]) => void;
  // Daily Review props
  showDailyReview: boolean;
  onCloseDailyReview: () => void;
  onSaveDailyReview: (fields: Partial<DailyReview>) => void;
  todayTasks: Task[];
  completedTodayTasksCount: number;
  waterValue: number;
  booleanRoutinesCount: number;
  completedRoutinesCount: number;
  onRescheduleTaskTomorrow: (taskId: string) => void;
  onOpenSplitFromDailyReview: (task: Task) => void;
  onCancelTaskFromDailyReview: (taskId: string) => void;
  // Weekly Review props
  showWeeklyReview: boolean;
  onCloseWeeklyReview: () => void;
  onSaveWeeklyReview: (fields: Partial<WeeklyReview>) => void;
  activeGoals: Goal[];
  routines: Routine[];
  routineLogs: RoutineLog[];
  dayPlans: DayPlan[];
  onOpenQualityGate: (goalId: string) => void;
}

export function TodayReviewModals({
  today,
  splittingTaskId,
  splitLinesText,
  onChangeSplitLinesText,
  onCloseSplit,
  onSubmitSplit,
  showDailyReview,
  onCloseDailyReview,
  onSaveDailyReview,
  todayTasks,
  completedTodayTasksCount,
  waterValue,
  booleanRoutinesCount,
  completedRoutinesCount,
  onRescheduleTaskTomorrow,
  onOpenSplitFromDailyReview,
  onCancelTaskFromDailyReview,
  showWeeklyReview,
  onCloseWeeklyReview,
  onSaveWeeklyReview,
  activeGoals,
  routines,
  routineLogs,
  dayPlans,
  onOpenQualityGate,
}: TodayReviewModalsProps) {
  // Local daily review form state
  const [surpriseText, setSurpriseText] = useState('');
  const [changeTomorrow, setChangeTomorrow] = useState('');

  // Local weekly review form state
  const [weeklyAccomplishments, setWeeklyAccomplishments] = useState('');
  const [weeklyChallenges, setWeeklyChallenges] = useState('');
  const [weeklyDecisions, setWeeklyDecisions] = useState('');
  const [weeklyNextPriorities, setWeeklyNextPriorities] = useState('');

  return (
    <>
      {/* 1. Task Split Modal */}
      {splittingTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Task Ko Chhota Karo (Split into 2-4 Steps)
            </h3>
            <p className="text-xs text-slate-500">
              Har line ek naya chhota actionable task ban jayegi aur bada parent task cancel ho jayega.
            </p>
            <textarea
              rows={4}
              value={splitLinesText}
              onChange={(e) => onChangeSplitLinesText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-base text-slate-900 dark:text-slate-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCloseSplit}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  onSubmitSplit(
                    splittingTaskId,
                    splitLinesText.split('\n')
                  )
                }
                className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
              >
                Split Tasks Save Karo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Daily Review Modal (Section 8.5) */}
      {showDailyReview && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {STRINGS.reviews.dailyTitle} ({today})
            </h3>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3.5 text-xs space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Auto-Summary (Aaj Kya Hua):
              </p>
              <p className="text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                Routines Done: {completedRoutinesCount}/{booleanRoutinesCount} · Water:{' '}
                {waterValue} ml · Tasks Completed: {completedTodayTasksCount}
              </p>
            </div>

            {todayTasks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Aaj Ke Pending Tasks ({todayTasks.length}) — Endless Carryover Mat Karein:
                </p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  {todayTasks.map((t) => (
                    <div
                      key={t.id}
                      className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        {t.title}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRescheduleTaskTomorrow(t.id)}
                          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                        >
                          {STRINGS.reviews.pendingActions.tomorrow}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenSplitFromDailyReview(t)}
                          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-medium"
                        >
                          {STRINGS.reviews.pendingActions.split}
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancelTaskFromDailyReview(t.id)}
                          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium"
                        >
                          {STRINGS.reviews.pendingActions.cancel}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kuch unexpected ya naya kya hua aaj? (Optional)
              </label>
              <input
                type="text"
                value={surpriseText}
                onChange={(e) => setSurpriseText(e.target.value)}
                placeholder="e.g. Duty shift lambi rahi ya extra travel..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kal ke plan me kya 1 chhota badlav karna hai? (Optional)
              </label>
              <input
                type="text"
                value={changeTomorrow}
                onChange={(e) => setChangeTomorrow(e.target.value)}
                placeholder="e.g. Subah sabse pehle Main Priority ke 15 min..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCloseDailyReview}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveDailyReview({
                    reviewDate: today,
                    completedText: `Tasks: ${completedTodayTasksCount}, Water: ${waterValue}ml`,
                    pendingText: `${todayTasks.length} pending`,
                    surpriseText,
                    changeTomorrow,
                  });
                  onCloseDailyReview();
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
              >
                Daily Review Save Karo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Weekly Review Modal (Section 8.6) */}
      {showWeeklyReview && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {STRINGS.reviews.weeklyTitle} (Week of {weekStartMonday(today)})
            </h3>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3.5 text-xs space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Active Goals Check ({activeGoals.length} Active):
              </p>
              {activeGoals.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between text-slate-600 dark:text-slate-400"
                >
                  <span>• {g.title}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onCloseWeeklyReview();
                      onOpenQualityGate(g.id);
                    }}
                    className="text-teal-700 dark:text-teal-400 underline ml-2"
                  >
                    Review / Pause
                  </button>
                </div>
              ))}
            </div>

            {/* Routine Insights Analysis for Weekly Review */}
            <RoutineInsightsCard
              routines={routines}
              logs={routineLogs}
              today={today}
              dayPlans={dayPlans}
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                1. Is hafte kya achha raha (Accomplishments)?
              </label>
              <textarea
                rows={2}
                value={weeklyAccomplishments}
                onChange={(e) => setWeeklyAccomplishments(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                2. Kahan atke ya kya mushkil aayi (Challenges)?
              </label>
              <textarea
                rows={2}
                value={weeklyChallenges}
                onChange={(e) => setWeeklyChallenges(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                3. Kaunsa goal pause/adjust karna hai (Decisions)?
              </label>
              <input
                type="text"
                value={weeklyDecisions}
                onChange={(e) => setWeeklyDecisions(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                4. Agle hafte ki top 3 priorities:
              </label>
              <textarea
                rows={2}
                value={weeklyNextPriorities}
                onChange={(e) => setWeeklyNextPriorities(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-base"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCloseWeeklyReview}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onSaveWeeklyReview({
                    weekStart: weekStartMonday(today),
                    accomplishments: weeklyAccomplishments,
                    challenges: weeklyChallenges,
                    decisions: weeklyDecisions,
                    nextPriorities: weeklyNextPriorities,
                  });
                  onCloseWeeklyReview();
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
              >
                Weekly Review Save Karo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
