'use client';

import React from 'react';
import { Target } from 'lucide-react';
import { Goal, LifeArea } from '@/src/lib/types';

interface GoalsCandidatesSectionProps {
  candidateGoals: Goal[];
  lifeAreas: LifeArea[];
  onOpenGoalWorkspace: (goal: Goal, initialStep: 'edit' | 'plan' | 'process') => void;
}

export function GoalsCandidatesSection({
  candidateGoals,
  lifeAreas,
  onOpenGoalWorkspace,
}: GoalsCandidatesSectionProps) {
  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Goal Candidates Quality Gate ke review ka intezaar kar rahe hain. Har candidate ko review karke Active Goal, Someday ya Project me badlein:
      </p>
      {candidateGoals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Koi pending Goal Candidate nahi hai.
          </p>
          <p className="text-xs text-slate-500">
            Brain Dump se &ldquo;B. Goal Candidate&rdquo; chunne par yahan Quality Gate review ke liye aayega.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {candidateGoals.map((goal, idx) => {
            const areaName =
              lifeAreas.find((a) => a.id === goal.lifeAreaId)?.name ||
              'General';
            return (
              <div
                key={goal.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-300/80 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    <span>#{idx + 1}</span>
                    <span>·</span>
                    <span>{areaName}</span>
                    <span>·</span>
                    <span>⏳ Candidate</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                    {goal.title}
                  </h3>
                  {goal.desiredOutcome && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      Outcome: {goal.desiredOutcome}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenGoalWorkspace(goal, 'edit')}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Quality Gate Review</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
