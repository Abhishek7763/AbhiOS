'use client';

import React from 'react';
import { Play } from 'lucide-react';
import { Goal, LifeArea } from '@/src/lib/types';

interface GoalsSomedaySectionProps {
  somedayGoals: Goal[];
  lifeAreas: LifeArea[];
  onActivateGoal: (goalId: string) => void;
  onOpenGoalWorkspace: (goal: Goal, initialStep: 'edit' | 'plan' | 'process') => void;
}

export function GoalsSomedaySection({
  somedayGoals,
  lifeAreas,
  onActivateGoal,
  onOpenGoalWorkspace,
}: GoalsSomedaySectionProps) {
  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Someday / Maybe goals intentionally abhi active nahi hain. Jab waqt aur capacity ho tab inhen active karein:
      </p>
      {somedayGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Someday / Maybe list abhi khali hai.
          </p>
          <p className="text-xs text-slate-500">
            Jo goals abhi shuru nahi karne unhe Someday / Maybe me pause karke rakh sakte hain.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {somedayGoals.map((goal, idx) => {
            const areaName =
              lifeAreas.find((a) => a.id === goal.lifeAreaId)?.name ||
              'General';
            return (
              <div
                key={goal.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                    <span>#{idx + 1}</span>
                    <span>·</span>
                    <span>{areaName}</span>
                    <span>·</span>
                    <span>⏸️ Someday / Maybe</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {goal.title}
                  </h3>
                  {goal.purposeReason && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Reason: {goal.purposeReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onActivateGoal(goal.id)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Active Karo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenGoalWorkspace(goal, 'edit')}
                    className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
