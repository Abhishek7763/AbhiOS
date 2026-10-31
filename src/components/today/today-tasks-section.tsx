'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  MoreHorizontal,
  Play,
  RotateCcw,
  Scissors,
  Zap,
} from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import { Task, Goal } from '@/src/lib/types';
import { AnimatedCheckButton } from '@/src/components/animated-check-button';

interface TodayTasksSectionProps {
  todayTasks: Task[];
  completedTodayTasks: Task[];
  mainPriorityTaskId?: string;
  totalScheduledMinutes: number;
  budgetMinutes: number;
  allTasksCount: number;
  goals: Goal[];
  celebratingId: string | null;
  completingIds: Record<string, boolean>;
  expandedTaskMenuId: string | null;
  showCompletedToday: boolean;
  onToggleShowCompletedToday: () => void;
  onOpenTasksTab: () => void;
  onToggleTaskDone: (task: Task) => void;
  onReopenTask: (taskId: string) => void;
  onStartFocus: (task: Task) => void;
  onToggleMenu: (taskId: string) => void;
  onMakeMainPriority: (taskId: string) => void;
  onRescheduleTomorrow: (taskId: string) => void;
  onTwoMinuteStarter: (task: Task) => void;
  onOpenSplit: (task: Task) => void;
}

export const TodayTasksSection = React.memo(function TodayTasksSection({
  todayTasks,
  completedTodayTasks,
  mainPriorityTaskId,
  totalScheduledMinutes,
  budgetMinutes,
  allTasksCount,
  goals,
  celebratingId,
  completingIds,
  expandedTaskMenuId,
  showCompletedToday,
  onToggleShowCompletedToday,
  onOpenTasksTab,
  onToggleTaskDone,
  onReopenTask,
  onStartFocus,
  onToggleMenu,
  onMakeMainPriority,
  onRescheduleTomorrow,
  onTwoMinuteStarter,
  onOpenSplit,
}: TodayTasksSectionProps) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {STRINGS.today.tasksTitle} ({todayTasks.length} Baaki ·{' '}
            {completedTodayTasks.length} Done)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            Baaki Time: {totalScheduledMinutes} min · 80% Safe Budget:{' '}
            {budgetMinutes} min
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenTasksTab}
          className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          Sabhi Tasks ({allTasksCount})
        </button>
      </div>

      {todayTasks.length === 0 && completedTodayTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-1.5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Aaj ke liye koi aur task scheduled nahi hai.
          </p>
          <p className="text-xs text-slate-500">
            Zarurat ho tabhi Tasks tab se jodein — har waqt busy rehna zaruri nahi hai.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending Tasks List */}
          {todayTasks.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayTasks.map((task) => {
                const isMain = task.id === mainPriorityTaskId;
                const isCompleting = Boolean(completingIds[task.id]);
                const isCelebrating = celebratingId === task.id || isCompleting;
                const isMenuOpen = expandedTaskMenuId === task.id;
                const linkedGoal = goals.find((g) => g.id === task.goalId);

                return (
                  <motion.div
                    key={task.id}
                    layout
                    animate={
                      isCelebrating
                        ? {
                            backgroundColor: [
                              'rgba(16, 185, 129, 0.20)',
                              'rgba(16, 185, 129, 0.05)',
                            ],
                            scale: [1, 1.01, 1],
                          }
                        : {}
                    }
                    transition={{ duration: 0.45 }}
                    className={`py-3.5 first:pt-1 last:pb-1 flex flex-col gap-2.5 rounded-xl px-2 transition-colors ${
                      isCompleting
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <AnimatedCheckButton
                          checked={isCompleting}
                          celebrating={isCelebrating}
                          onToggle={() => onToggleTaskDone(task)}
                          ariaLabel={`Complete task ${task.title}`}
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`text-sm font-semibold transition-all duration-300 ${
                                isCompleting
                                  ? 'line-through text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {task.title}
                            </p>
                            {isCompleting && (
                              <motion.span
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold"
                              >
                                ✓ Pura Hua!
                              </motion.span>
                            )}
                            {isMain && !isCompleting && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-[11px] font-semibold">
                                ★ Main Priority
                              </span>
                            )}
                          </div>

                          {task.nextAction && !isCompleting && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                              → {task.nextAction}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums mt-1">
                            <span>{task.estMinutes ?? 20} min</span>
                            {linkedGoal && (
                              <>
                                <span>·</span>
                                <span className="font-sans text-slate-600 dark:text-slate-400">
                                  {linkedGoal.title}
                                </span>
                              </>
                            )}
                            {task.rescheduleCount >= 3 && (
                              <>
                                <span>·</span>
                                <span className="text-amber-700 dark:text-amber-400 font-sans">
                                  {task.rescheduleCount}x टला
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Clean Primary Action + Progressive Disclosure Menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onStartFocus(task)}
                          aria-label={`Focus on ${task.title}`}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 flex items-center gap-1 whitespace-nowrap"
                        >
                          <Play className="w-3 h-3" />
                          Focus
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleMenu(task.id)}
                          aria-label={`More options for ${task.title}`}
                          className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-xs transition-colors ${
                            isMenuOpen
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progressive Disclosure Secondary Task Options */}
                    {isMenuOpen && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-9 pt-1">
                        {!isMain && (
                          <button
                            type="button"
                            onClick={() => onMakeMainPriority(task.id)}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                          >
                            ★ Make Main Priority
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRescheduleTomorrow(task.id)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
                        >
                          Kal Karo (Tomorrow)
                        </button>
                        <button
                          type="button"
                          onClick={() => onTwoMinuteStarter(task)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3 text-teal-600" />
                          2-Min Starter Split
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenSplit(task)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1"
                        >
                          <Scissors className="w-3 h-3" />
                          Chhota Karo (Split)
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-900/50 p-4 text-center">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                🎉 Aaj ke sabhi scheduled tasks pure ho gaye!
              </p>
            </div>
          )}

          {/* Completed Today Section */}
          {completedTodayTasks.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={onToggleShowCompletedToday}
                className="w-full flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400 py-1 hover:underline"
              >
                <span>
                  ✓ Aaj Complete Hue Tasks ({completedTodayTasks.length})
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showCompletedToday ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showCompletedToday && (
                <div className="space-y-1.5">
                  {completedTodayTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-2 border border-emerald-100 dark:border-emerald-900/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AnimatedCheckButton
                          size="sm"
                          checked={true}
                          celebrating={celebratingId === task.id}
                          onToggle={() => onReopenTask(task.id)}
                          ariaLabel={`Reopen completed task ${task.title}`}
                        />
                        <span className="text-xs sm:text-sm font-medium line-through text-slate-400 dark:text-slate-500 truncate">
                          {task.title}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                          ✓ Done
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onReopenTask(task.id)}
                        className="min-h-[32px] px-2 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Undo
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
