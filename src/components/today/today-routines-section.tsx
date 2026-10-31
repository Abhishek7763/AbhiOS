'use client';

import React from 'react';
import {
  Briefcase,
  ChevronDown,
  Clock,
  Moon,
  SkipForward,
  Sun,
} from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import { Routine, RoutineBlock, RoutineLog, UserSettings, DayPlan } from '@/src/lib/types';
import {
  computeRoutineDueMinutes,
  formatMinutesToTime,
} from '@/src/lib/logic/dates';
import { AnimatedCheckButton } from '@/src/components/animated-check-button';

interface TodayRoutinesSectionProps {
  booleanRoutines: Routine[];
  logByRoutineId: Map<string, RoutineLog>;
  completedRoutinesCount: number;
  settings: UserSettings;
  todayPlan: DayPlan;
  celebratingId: string | null;
  collapsedBlocks: Record<string, boolean>;
  onToggleBlockCollapse: (blockKey: string) => void;
  onTickRoutine: (routineId: string, title: string, isDone: boolean) => void;
  onSkipRoutine: (routineId: string) => void;
}

export function TodayRoutinesSection({
  booleanRoutines,
  logByRoutineId,
  completedRoutinesCount,
  settings,
  todayPlan,
  celebratingId,
  collapsedBlocks,
  onToggleBlockCollapse,
  onTickRoutine,
  onSkipRoutine,
}: TodayRoutinesSectionProps) {
  const blocks: Array<{
    key: RoutineBlock;
    label: string;
    icon: React.ReactNode;
  }> = [
    { key: 'morning', label: 'Subah (Morning)', icon: <Sun className="w-4 h-4" /> },
    {
      key: 'duty',
      label: 'Duty Preparation',
      icon: <Briefcase className="w-4 h-4" />,
    },
    { key: 'evening', label: 'Shaam (Evening)', icon: <Moon className="w-4 h-4" /> },
    { key: 'anytime', label: 'Anytime', icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {STRINGS.today.routinesTitle}
        </h2>
        <span className="text-xs text-slate-500 font-mono tabular-nums">
          {completedRoutinesCount}/{booleanRoutines.length} Done
        </span>
      </div>

      <div className="space-y-3">
        {blocks.map((b) => {
          const items = booleanRoutines.filter((r) => r.block === b.key);
          if (items.length === 0) return null;
          const blockDoneCount = items.filter(
            (r) => logByRoutineId.get(r.id)?.status === 'done'
          ).length;
          const isCollapsed = Boolean(collapsedBlocks[b.key]);

          return (
            <div key={b.key} className="space-y-2">
              <button
                type="button"
                onClick={() => onToggleBlockCollapse(b.key)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  {b.icon}
                  <span>{b.label}</span>
                </span>
                <span className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  <span>
                    {blockDoneCount}/{items.length} Done
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                </span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                  {items.map((routine) => {
                    const log = logByRoutineId.get(routine.id);
                    const isDone = log?.status === 'done';
                    const isSkipped = log?.status === 'skipped';
                    const isCelebrating = celebratingId === routine.id;
                    const dueMins = computeRoutineDueMinutes(
                      routine,
                      settings,
                      todayPlan
                    );

                    return (
                      <div
                        key={routine.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 transition-colors ${
                          isDone
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <AnimatedCheckButton
                            size="sm"
                            checked={isDone}
                            skipped={isSkipped}
                            celebrating={isCelebrating}
                            onToggle={() =>
                              onTickRoutine(
                                routine.id,
                                routine.title,
                                isDone
                              )
                            }
                            ariaLabel={`Toggle routine ${routine.title}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onTickRoutine(
                                routine.id,
                                routine.title,
                                isDone
                              )
                            }
                            className="flex-1 text-left py-1 min-w-0"
                          >
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-sm font-medium transition-all ${
                                  isDone
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : isSkipped
                                      ? 'text-slate-400 italic'
                                      : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {routine.title}
                              </p>
                              {isDone && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                  ✓
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono tabular-nums">
                              {dueMins !== null
                                ? `Due ${formatMinutesToTime(dueMins)}`
                                : 'Duty time set karein'}
                              {routine.isMust ? ' · Must' : ''}
                              {isSkipped ? ' · Skipped today' : ''}
                            </p>
                          </button>
                        </div>

                        {!isDone && !isSkipped && (
                          <button
                            type="button"
                            onClick={() => onSkipRoutine(routine.id)}
                            aria-label={`Skip ${routine.title}`}
                            className="min-h-[44px] px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 shrink-0"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            Skip
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
