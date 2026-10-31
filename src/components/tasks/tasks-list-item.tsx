'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  Check,
  MoreHorizontal,
  Pause,
  RotateCcw,
  Scissors,
  XCircle,
  Zap,
} from 'lucide-react';
import { Task, Goal, Project } from '@/src/lib/types';
import { STRINGS } from '@/src/lib/strings';
import { AnimatedCheckButton } from '@/src/components/animated-check-button';

interface TasksListItemProps {
  task: Task;
  today: string;
  linkedGoal?: Goal;
  linkedProject?: Project;
  isDone: boolean;
  isCelebrating: boolean;
  isCompleting: boolean;
  isMenuOpen: boolean;
  onToggleDone: () => void;
  onReopen: () => void;
  onReschedule: (date: string) => void;
  onToggleMenu: () => void;
  onSplitTask: () => void;
  onTwoMinuteStarter: () => void;
  onPause: () => void;
  onCancel: () => void;
}

export const TasksListItem = React.memo(function TasksListItem({
  task,
  today,
  linkedGoal,
  linkedProject,
  isDone,
  isCelebrating,
  isCompleting,
  isMenuOpen,
  onToggleDone,
  onReopen,
  onReschedule,
  onToggleMenu,
  onSplitTask,
  onTwoMinuteStarter,
  onPause,
  onCancel,
}: TasksListItemProps) {
  return (
    <motion.div
      layout
      animate={
        isCelebrating
          ? {
              backgroundColor: [
                'rgba(16, 185, 129, 0.18)',
                'rgba(16, 185, 129, 0.04)',
              ],
              scale: [1, 1.008, 1],
            }
          : {}
      }
      transition={{ duration: 0.45 }}
      className={`p-4 sm:p-5 flex flex-col gap-3 transition-colors ${
        isDone ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {task.status === 'todo' ||
          task.status === 'doing' ||
          task.status === 'done' ? (
            <AnimatedCheckButton
              checked={isDone}
              celebrating={isCelebrating}
              onToggle={onToggleDone}
              ariaLabel={
                isDone ? `Reopen ${task.title}` : `Complete ${task.title}`
              }
            />
          ) : (
            <Check className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          )}

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-sm sm:text-base font-semibold transition-all duration-300 ${
                  isDone || task.status === 'cancelled'
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {task.title}
              </h3>
              {isDone && (
                <motion.span
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold"
                >
                  ✓ Pura Hua
                </motion.span>
              )}
            </div>

            {task.nextAction && !isDone && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Next Action: {task.nextAction}
              </p>
            )}

            {/* Unboxed Metadata with · separators */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>{task.estMinutes ?? 20} min</span>
              {task.scheduledDate && (
                <>
                  <span>·</span>
                  <span>Scheduled: {task.scheduledDate}</span>
                </>
              )}
              {task.dueDate && (
                <>
                  <span>·</span>
                  <span>Due: {task.dueDate}</span>
                </>
              )}
              {linkedGoal && (
                <>
                  <span>·</span>
                  <span className="font-sans">Goal: {linkedGoal.title}</span>
                </>
              )}
              {linkedProject && (
                <>
                  <span>·</span>
                  <span className="font-sans">
                    Project: {linkedProject.title}
                  </span>
                </>
              )}
              {task.recurrence && task.recurrence !== 'none' && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-[11px] font-semibold font-sans">
                    ↻ {task.recurrence}
                  </span>
                </>
              )}
              {task.rescheduleCount >= 3 && !isDone && (
                <>
                  <span>·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-sans">
                    {STRINGS.today.rescheduleWarning}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Primary Action + Progressive Disclosure Menu */}
        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
          {(task.status === 'todo' || task.status === 'doing') &&
          !isCompleting ? (
            <>
              {task.scheduledDate !== today ? (
                <button
                  type="button"
                  onClick={() => onReschedule(today)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-semibold whitespace-nowrap"
                >
                  Aaj Karo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onReschedule('tomorrow')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium whitespace-nowrap"
                >
                  Kal Karo
                </button>
              )}
              <button
                type="button"
                onClick={onToggleMenu}
                aria-label={`More actions for ${task.title}`}
                className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg transition-colors ${
                  isMenuOpen
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onReopen}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Secondary Actions Drawer */}
      {isMenuOpen && !isDone && (
        <div className="flex flex-wrap items-center gap-2 pl-9 pt-1 border-t border-slate-100 dark:border-slate-800/70">
          {task.scheduledDate !== today && (
            <button
              type="button"
              onClick={() => onReschedule('tomorrow')}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
            >
              Kal Karo
            </button>
          )}
          <button
            type="button"
            onClick={onTwoMinuteStarter}
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5 text-teal-600" />
            2-Min Starter Split
          </button>
          <button
            type="button"
            onClick={onSplitTask}
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1"
          >
            <Scissors className="w-3.5 h-3.5" />
            Chhota Karo (Split)
          </button>
          <button
            type="button"
            onClick={onPause}
            className="min-h-[34px] px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center gap-1"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[34px] px-2.5 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
});
