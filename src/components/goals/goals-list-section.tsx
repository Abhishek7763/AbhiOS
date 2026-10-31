'use client';

import React from 'react';
import {
  ArrowDown,
  Calendar,
  Edit3,
  Plus,
} from 'lucide-react';
import { Goal, LifeArea, Milestone, Task } from '@/src/lib/types';
import { computeGoalProgressAndNextStep } from '@/src/lib/logic/planner';

const formatTagLabel = (tag: string) =>
  tag.startsWith('#') ? tag : `#${tag}`;

interface GoalsListSectionProps {
  selectedArea: LifeArea;
  selectedCategoryGoals: Goal[];
  milestones: Milestone[];
  tasks: Task[];
  today: string;
  editingCategoriesMode: boolean;
  onOpenGoalWorkspace: (goal: Goal, initialStep: 'edit' | 'plan' | 'process') => void;
  onOpenAddGoalDrawer: () => void;
  onToggleEditingCategories: () => void;
  onRescheduleTaskToday: (taskId: string) => void;
}

export function GoalsListSection({
  selectedArea,
  selectedCategoryGoals,
  milestones,
  tasks,
  today,
  editingCategoriesMode,
  onOpenGoalWorkspace,
  onOpenAddGoalDrawer,
  onToggleEditingCategories,
  onRescheduleTaskToday,
}: GoalsListSectionProps) {
  return (
    <section className="space-y-3">
      {/* Visual Arrow Indicator matching the ↓ arrow in User Sketch 2 */}
      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-0.5">
        <ArrowDown className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mt-0.5">
          {selectedArea.name} Goals ({selectedCategoryGoals.length})
        </span>
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {selectedArea.name} — Goals List
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Goal par click karke pura Edit karein, Plan (Steps) banayein aur Daily Tasks jodein.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddGoalDrawer}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add in {selectedArea.name}</span>
          </button>
        </div>

        {selectedCategoryGoals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {selectedArea.name} me abhi koi Goal nahi hai (0).
            </p>
            <p className="text-xs text-slate-500">
              Brain Dump se filter karke yahan bhejein ya niche &ldquo;+ Add New&rdquo; button dabayein.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedCategoryGoals.map((goal, idx) => {
              const isOngoing = goal.goalType === 'ongoing_direction';
              const progress = computeGoalProgressAndNextStep(
                goal.id,
                milestones,
                tasks
              );

              return (
                <div
                  key={goal.id}
                  onClick={() => onOpenGoalWorkspace(goal, 'edit')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenGoalWorkspace(goal, 'edit');
                    }
                  }}
                  className="group cursor-pointer rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-teal-600 dark:hover:border-teal-500 bg-[#FAF8F5]/60 dark:bg-slate-950 px-4 py-3.5 transition-all flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="w-7 h-7 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                            {goal.title}
                          </h3>
                          {isOngoing && (
                            <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                              ♾️ Ongoing
                            </span>
                          )}
                        </div>

                        {/* Visual Progress Bar + Step Counter */}
                        <div className="space-y-1 max-w-md">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                            <span>
                              Progress: {progress.completedSteps}/
                              {progress.totalSteps} Steps ({progress.percent}
                              %)
                            </span>
                            {(goal.tags || []).length > 0 && (
                              <span>
                                {(goal.tags || [])
                                  .slice(0, 2)
                                  .map(formatTagLabel)
                                  .join(' ')}
                              </span>
                            )}
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all duration-300"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Next Up Step Indicator */}
                        {(progress.nextUpTask ||
                          progress.nextUpMilestone) && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="text-xs text-teal-800 dark:text-teal-300 font-medium truncate max-w-xs sm:max-w-md">
                              → Next Up:{' '}
                              {progress.nextUpTask?.title ||
                                progress.nextUpMilestone?.title}
                            </span>
                            {progress.nextUpTask &&
                              progress.nextUpTask.scheduledDate !== today && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRescheduleTaskToday(progress.nextUpTask!.id);
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-teal-100/90 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[11px] font-semibold hover:bg-teal-200 flex items-center gap-1"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span>Aaj Schedule Karo</span>
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-700 group-hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit → Plan → Process</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Action Bar matching Sketch 2: [ add new ]  [ edit ] */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onOpenAddGoalDrawer}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>add new</span>
          </button>

          <button
            type="button"
            onClick={onToggleEditingCategories}
            className={`min-h-[46px] px-4 py-2.5 rounded-2xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              editingCategoriesMode
                ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>
              {editingCategoriesMode
                ? 'done editing'
                : 'edit'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
