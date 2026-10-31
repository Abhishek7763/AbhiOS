'use client';

import React, { useMemo } from 'react';
import { Sparkles, Info, Lightbulb, Clock } from 'lucide-react';
import { Routine, RoutineLog, DayPlan } from '@/src/lib/types';
import { computeRoutineInsights } from '@/src/lib/logic/planner';
import { STRINGS } from '@/src/lib/strings';

interface RoutineInsightsCardProps {
  routines: Routine[];
  logs: RoutineLog[];
  today: string;
  dayPlans?: DayPlan[];
}

export function RoutineInsightsCard({
  routines,
  logs,
  today,
  dayPlans = [],
}: RoutineInsightsCardProps) {
  const report = useMemo(() => {
    return computeRoutineInsights(routines, logs, today, 14, dayPlans);
  }, [routines, logs, today, dayPlans]);

  const { insights, hasInsights, calmSummaryText } = report;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xs">
      {/* Title & Philosophy Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {STRINGS.routineInsights.title}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {STRINGS.routineInsights.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Calm Status Summary */}
      <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
        <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
        <span>{calmSummaryText}</span>
      </div>

      {/* Routine Cards List */}
      {!hasInsights ? (
        <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
          {STRINGS.routineInsights.noDataNotice}
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((item) => {
            const suggestion = item.gentleSuggestionKey
              ? STRINGS.routineInsights.suggestions[item.gentleSuggestionKey]
              : null;

            return (
              <div
                key={item.routineId}
                className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/50 p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                      {item.block}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {STRINGS.routineInsights.applicableDone(
                      item.doneCount,
                      item.applicableDays
                    )}
                  </span>
                </div>

                {/* Calm Progress Bar (Zero guilt, informative only) */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 dark:bg-teal-500 transition-all duration-300"
                    style={{ width: `${item.completionRatePercent}%` }}
                  />
                </div>

                {/* Gentle Suggestion if missed on >= 5 days */}
                {suggestion && (
                  <div className="rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 p-2.5 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="leading-relaxed">{suggestion}</p>
                      <p className="text-[10px] text-teal-700/80 dark:text-teal-400/80 flex items-center gap-1">
                        <Clock className="w-3 h-3 inline" />
                        <span>
                          {STRINGS.routineInsights.missedWindow(item.block)}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
