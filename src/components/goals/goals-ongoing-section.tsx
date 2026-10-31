'use client';

import React from 'react';
import { Edit3 } from 'lucide-react';
import { Goal, LifeArea } from '@/src/lib/types';

interface GoalsOngoingSectionProps {
  ongoingGoals: Goal[];
  lifeAreas: LifeArea[];
  onOpenGoalWorkspace: (goal: Goal, initialStep: 'edit' | 'plan' | 'process') => void;
}

export function GoalsOngoingSection({
  ongoingGoals,
  lifeAreas,
  onOpenGoalWorkspace,
}: GoalsOngoingSectionProps) {
  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Ongoing Goals ek baar set hone par hamesha chalte rehte hain. Kisi bhi goal par tap karke Edit ya Plan badlein:
      </p>
      {ongoingGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Koi Ongoing Goal nahi hai.
          </p>
          <p className="text-xs text-slate-500">
            Naya goal banate waqt &ldquo;♾️ Ongoing Goal&rdquo; chunein taaki wo hamesha active rahe.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {ongoingGoals.map((goal, idx) => {
            const areaName =
              lifeAreas.find((a) => a.id === goal.lifeAreaId)?.name ||
              'General';
            return (
              <div
                key={goal.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-teal-300/80 dark:border-teal-800/80 bg-teal-50/30 dark:bg-teal-950/20 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-teal-800 dark:text-teal-300 font-semibold">
                    <span>#{idx + 1}</span>
                    <span>·</span>
                    <span>{areaName}</span>
                    <span>·</span>
                    <span>♾️ Ongoing</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {goal.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenGoalWorkspace(goal, 'edit')}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit & Plan</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
