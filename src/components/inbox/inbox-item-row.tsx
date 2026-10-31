'use client';

import React from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CornerDownRight,
  SlidersHorizontal,
  Target,
  Trash2,
} from 'lucide-react';
import { Goal, GoalType, InboxItem, LifeArea } from '@/src/lib/types';

interface InboxItemRowProps {
  item: InboxItem;
  index: number;
  assignedArea?: LifeArea;
  isContextOpen: boolean;
  onToggleContextMenu: () => void;
  onOpenFilterModal: () => void;
  onMoveToTrash: () => void;
  // Inline contextual menu props
  activeLifeAreas: LifeArea[];
  activeGoals: Goal[];
  inlineTargetGoalId: string;
  onSelectInlineTargetGoal: (goalId: string) => void;
  inlineStepType: 'milestone' | 'task';
  onChangeInlineStepType: (type: 'milestone' | 'task') => void;
  inlineGoalType: GoalType;
  onChangeInlineGoalType: (type: GoalType) => void;
  onAssignCategory: (areaId: string) => void;
  onSendToGoalCategory: (areaId: string, goalType: GoalType) => void;
  onMoveToSpecificGoal: (goalId: string, stepType: 'milestone' | 'task') => void;
}

export const InboxItemRow = React.memo(function InboxItemRow({
  item,
  index,
  assignedArea,
  isContextOpen,
  onToggleContextMenu,
  onOpenFilterModal,
  onMoveToTrash,
  activeLifeAreas,
  activeGoals,
  inlineTargetGoalId,
  onSelectInlineTargetGoal,
  inlineStepType,
  onChangeInlineStepType,
  inlineGoalType,
  onChangeInlineGoalType,
  onAssignCategory,
  onSendToGoalCategory,
  onMoveToSpecificGoal,
}: InboxItemRowProps) {
  const isSochVichar = item.status === 'someday';

  return (
    <article
      className={`transition-colors ${
        isContextOpen
          ? 'bg-teal-50/25 dark:bg-teal-950/15'
          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
      }`}
    >
      {/* Minimalist Item Row with generous whitespace */}
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Left: Index Number + Thought Content + Metadata */}
          <div
            className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer"
            onClick={onToggleContextMenu}
          >
            <span className="font-mono text-sm sm:text-base font-bold text-slate-500 dark:text-slate-400 pt-0.5 select-none shrink-0 w-6">
              {index + 1}.
            </span>

            <div className="flex-1 min-w-0 space-y-2.5">
              <p className="text-[15px] sm:text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed break-words">
                {item.content}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {assignedArea ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-medium border border-teal-200/60 dark:border-teal-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
                    {assignedArea.name}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500">
                    Uncategorized
                  </span>
                )}

                {isSochVichar && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-medium border border-amber-200/60 dark:border-amber-800/60">
                    <Clock className="w-3 h-3" />
                    Soch-Vichar
                  </span>
                )}

                {item.decisionNote && (
                  <span className="text-slate-500 dark:text-slate-400">
                    · {item.decisionNote}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Clean Minimalist Action Controls */}
          <div className="flex items-center justify-end gap-2 shrink-0 pl-10 sm:pl-0 pt-1 sm:pt-0">
            <button
              type="button"
              onClick={onToggleContextMenu}
              aria-expanded={isContextOpen}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isContextOpen
                  ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-600/60 text-teal-900 dark:text-teal-200'
                  : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>Category / Goal</span>
              {isContextOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenFilterModal}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            <button
              type="button"
              onClick={onMoveToTrash}
              aria-label={`Trash thought ${index + 1}`}
              title="Bekar thought — Trash me daalo"
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* INLINE CONTEXTUAL MENU FOR THIS ITEM */}
        {isContextOpen && (
          <div
            data-testid={`item-context-menu-${index + 1}`}
            className="mt-5 pt-5 border-t border-dashed border-slate-200 dark:border-slate-800 pl-0 sm:pl-10 space-y-5"
          >
            {/* 1. Assign Category or Convert to Category Goal */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  1. Category Assign Karein (1-Tap):
                </span>
                {assignedArea && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      aria-label="New goal mode"
                      value={inlineGoalType}
                      onChange={(e) =>
                        onChangeInlineGoalType(e.target.value as GoalType)
                      }
                      className="min-h-[32px] rounded-lg border border-teal-300/80 dark:border-teal-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-teal-900 dark:text-teal-200"
                    >
                      <option value="outcome">Target Goal</option>
                      <option value="ongoing_direction">Ongoing Goal</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        onSendToGoalCategory(assignedArea.id, inlineGoalType)
                      }
                      className="min-h-[32px] px-3 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Target className="w-3 h-3" />
                      <span>{assignedArea.name} me Naya Goal Banao →</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {activeLifeAreas.map((area) => {
                  const isCurrent = item.lifeAreaId === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => onAssignCategory(area.id)}
                      className={`min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-teal-700 text-white border-teal-700 font-semibold shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-500'
                      }`}
                    >
                      <span>{area.name}</span>
                      {isCurrent && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Move Directly to a Specific Goal */}
            {activeGoals.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/70">
                <span className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  2. Seedha Kisi Specific Goal me Move Karein:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    aria-label="Choose specific goal for item"
                    value={inlineTargetGoalId}
                    onChange={(e) => onSelectInlineTargetGoal(e.target.value)}
                    className="sm:col-span-7 w-full min-w-0 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                  >
                    {activeGoals.map((g) => {
                      const areaName =
                        activeLifeAreas.find((a) => a.id === g.lifeAreaId)?.name ||
                        'Goal';
                      return (
                        <option key={g.id} value={g.id}>
                          [{areaName}] {g.title}
                        </option>
                      );
                    })}
                  </select>

                  <div className="sm:col-span-5 flex items-center gap-1.5">
                    <select
                      aria-label="Inline move step type"
                      value={inlineStepType}
                      onChange={(e) =>
                        onChangeInlineStepType(
                          e.target.value as 'milestone' | 'task'
                        )
                      }
                      className="flex-1 min-w-0 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      <option value="milestone">As Plan Step</option>
                      <option value="task">As Daily Task</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        onMoveToSpecificGoal(
                          inlineTargetGoalId,
                          inlineStepType
                        )
                      }
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Move</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
});
