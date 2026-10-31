'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Pause,
  Play,
  Sparkles,
  Square,
  Timer,
} from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import {
  computeFocusProgress,
  formatFocusSeconds,
  suggestIfThenPlan,
} from '@/src/lib/logic/planner';
import { Task } from '@/src/lib/types';
import { AnimatedCheckButton } from '@/src/components/animated-check-button';

interface TodayMainPriorityProps {
  mainPriorityTask: Task | null;
  isMinimumDay: boolean;
  celebratingId: string | null;
  completingIds: Record<string, boolean>;
  goalTitle: string | null;
  onAutoSuggest: () => void;
  onCompleteTask: (task: Task) => void;
  // Focus Timer props
  focusTaskId: string | null;
  focusRunning: boolean;
  focusRemainingSec: number;
  focusTotalSec: number;
  onStartFocus: (task: Task) => void;
  onToggleFocusRunning: () => void;
  onSetFocusDuration: (minutes: number) => void;
  onAddFocusMinutes: (minutes: number) => void;
  onCloseFocus: () => void;
  onDoneFocus: (task?: Task) => void;
}

export function TodayMainPriority({
  mainPriorityTask,
  isMinimumDay,
  celebratingId,
  completingIds,
  goalTitle,
  onAutoSuggest,
  onCompleteTask,
  focusTaskId,
  focusRunning,
  focusRemainingSec,
  focusTotalSec,
  onStartFocus,
  onToggleFocusRunning,
  onSetFocusDuration,
  onAddFocusMinutes,
  onCloseFocus,
  onDoneFocus,
}: TodayMainPriorityProps) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
            Focus Anchor · 1 Main Priority
          </p>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {STRINGS.today.mainPriority}
          </h2>
        </div>
        <button
          type="button"
          onClick={onAutoSuggest}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          {STRINGS.today.suggestPriority}
        </button>
      </div>

      {mainPriorityTask ? (
        <motion.div
          layout
          animate={
            celebratingId === mainPriorityTask.id ||
            completingIds[mainPriorityTask.id]
              ? {
                  scale: [1, 1.015, 1],
                  borderColor: 'rgba(16, 185, 129, 0.7)',
                }
              : {}
          }
          transition={{ duration: 0.45 }}
          className={`rounded-xl border p-4 space-y-3 transition-colors ${
            completingIds[mainPriorityTask.id]
              ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-400 dark:border-emerald-700'
              : 'bg-slate-50 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AnimatedCheckButton
                size="lg"
                checked={Boolean(completingIds[mainPriorityTask.id])}
                celebrating={
                  celebratingId === mainPriorityTask.id ||
                  Boolean(completingIds[mainPriorityTask.id])
                }
                onToggle={() => onCompleteTask(mainPriorityTask)}
                ariaLabel={`Complete main priority ${mainPriorityTask.title}`}
              />

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={`text-base font-bold transition-all duration-300 ${
                      completingIds[mainPriorityTask.id]
                        ? 'line-through text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {mainPriorityTask.title}
                  </h3>
                  {completingIds[mainPriorityTask.id] && (
                    <motion.span
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold"
                    >
                      ✓ Shabaash! Pura Hua
                    </motion.span>
                  )}
                </div>
                {mainPriorityTask.nextAction && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Next Step: {mainPriorityTask.nextAction}
                  </p>
                )}
                {isMinimumDay && (
                  <p className="text-xs text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 rounded-lg px-2.5 py-1.5 mt-1">
                    Shield (Agar-To):{' '}
                    {suggestIfThenPlan(
                      mainPriorityTask.title,
                      mainPriorityTask.nextAction
                    )}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums pt-0.5">
                  <span>{mainPriorityTask.estMinutes ?? 25} min</span>
                  {mainPriorityTask.dueDate && (
                    <>
                      <span>·</span>
                      <span>Due: {mainPriorityTask.dueDate}</span>
                    </>
                  )}
                  {goalTitle && (
                    <>
                      <span>·</span>
                      <span className="font-sans">Goal: {goalTitle}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
              <button
                type="button"
                onClick={() => onStartFocus(mainPriorityTask)}
                aria-label={`Start Focus Timer for ${mainPriorityTask.title}`}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-teal-600/40 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Focus
              </button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => onCompleteTask(mainPriorityTask)}
                aria-label={`Mark main priority ${mainPriorityTask.title} done`}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                Ho Gaya ✓
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Aaj ke liye koi pending Main Priority nahi hai.
        </p>
      )}

      {/* Flexible Deep Work Focus Timer Panel */}
      {focusTaskId && (
        <div
          data-testid="focus-timer-panel"
          className="mt-4 rounded-xl bg-teal-950 text-teal-50 p-4 space-y-3 border border-teal-800"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Timer className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="truncate">
                <p className="text-[11px] uppercase tracking-wider text-teal-300 font-semibold">
                  Flexible Focus Session
                </p>
                <p className="text-sm font-bold truncate">
                  {mainPriorityTask?.id === focusTaskId
                    ? mainPriorityTask.title
                    : 'Focus Session'}
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold font-mono tabular-nums text-white whitespace-nowrap shrink-0">
              {formatFocusSeconds(focusRemainingSec)}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-teal-900 overflow-hidden">
            <div
              className="h-full bg-teal-400 transition-all duration-300"
              style={{
                width: `${computeFocusProgress(
                  focusRemainingSec,
                  focusTotalSec
                )}%`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {[10, 15, 25, 45].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSetFocusDuration(m)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-900/80 hover:bg-teal-800 text-teal-200 text-xs font-mono"
                >
                  {m}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => onAddFocusMinutes(5)}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-900/80 hover:bg-teal-800 text-teal-200 text-xs font-mono"
              >
                +5m
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleFocusRunning}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1"
              >
                {focusRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Resume
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDoneFocus(mainPriorityTask || undefined)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Done
              </button>
              <button
                type="button"
                onClick={onCloseFocus}
                aria-label="Close Focus Timer"
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-teal-900 hover:bg-teal-800 text-teal-200 text-xs"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
