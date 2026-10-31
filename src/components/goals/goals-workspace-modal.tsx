'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  Check,
  CheckSquare,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import { Goal, GoalType, LifeArea, Milestone, Task } from '@/src/lib/types';
import { STRINGS } from '@/src/lib/strings';
import { PRESET_GOAL_TAGS } from '@/src/lib/logic/planner';
import { AnimatedCheckButton } from '@/src/components/animated-check-button';

const formatTagLabel = (tag: string) =>
  tag.startsWith('#') ? tag : `#${tag}`;

interface GoalsWorkspaceModalProps {
  activeGoal: Goal | null;
  onClose: () => void;
  lifeAreas: LifeArea[];
  activeLifeAreas: LifeArea[];
  milestones: Milestone[];
  tasks: Task[];
  today: string;
  detailStep: 'edit' | 'plan' | 'process';
  onSetDetailStep: (step: 'edit' | 'plan' | 'process') => void;
  // Step 1: Edit
  editTitle: string;
  onChangeEditTitle: (val: string) => void;
  editAreaId: string;
  onChangeEditAreaId: (val: string) => void;
  editGoalType: GoalType;
  onChangeEditGoalType: (val: GoalType) => void;
  editOutcome: string;
  onChangeEditOutcome: (val: string) => void;
  editReason: string;
  onChangeEditReason: (val: string) => void;
  editTags: string[];
  onToggleTag: (tag: string) => void;
  editCustomTag: string;
  onChangeCustomTag: (val: string) => void;
  onAddCustomTag: () => void;
  onSaveGoalEdits: (e: React.FormEvent) => void;
  onTogglePauseGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
  // Step 2: Plan
  newMilestoneTitle: string;
  onChangeNewMilestoneTitle: (val: string) => void;
  onCreateMilestone: (title: string) => void;
  onToggleMilestoneStatus: (milestoneId: string, currentStatus: string) => void;
  onReorderMilestone: (milestoneId: string, direction: 'up' | 'down') => void;
  aiBreakdownLoading: boolean;
  aiSuggestedMilestones: string[];
  onAiSuggestMilestones: (goal: Goal) => void;
  onAcceptAiMilestone: (title: string, index: number) => void;
  // Step 3: Process
  newTaskTitle: string;
  onChangeNewTaskTitle: (val: string) => void;
  newTaskDate: string;
  onChangeNewTaskDate: (val: string) => void;
  newTaskEstMinutes: number;
  onChangeNewTaskEstMinutes: (val: number) => void;
  onCreateTask: () => void;
  completingTaskIds: string[];
  onToggleGoalTask: (taskId: string, isDone: boolean) => void;
  onViewToday: () => void;
}

export function GoalsWorkspaceModal({
  activeGoal,
  onClose,
  lifeAreas,
  activeLifeAreas,
  milestones,
  tasks,
  today,
  detailStep,
  onSetDetailStep,
  editTitle,
  onChangeEditTitle,
  editAreaId,
  onChangeEditAreaId,
  editGoalType,
  onChangeEditGoalType,
  editOutcome,
  onChangeEditOutcome,
  editReason,
  onChangeEditReason,
  editTags,
  onToggleTag,
  editCustomTag,
  onChangeCustomTag,
  onAddCustomTag,
  onSaveGoalEdits,
  onTogglePauseGoal,
  onDeleteGoal,
  newMilestoneTitle,
  onChangeNewMilestoneTitle,
  onCreateMilestone,
  onToggleMilestoneStatus,
  onReorderMilestone,
  aiBreakdownLoading,
  aiSuggestedMilestones,
  onAiSuggestMilestones,
  onAcceptAiMilestone,
  newTaskTitle,
  onChangeNewTaskTitle,
  newTaskDate,
  onChangeNewTaskDate,
  newTaskEstMinutes,
  onChangeNewTaskEstMinutes,
  onCreateTask,
  completingTaskIds,
  onToggleGoalTask,
  onViewToday,
}: GoalsWorkspaceModalProps) {
  if (!activeGoal) return null;

  const goalMilestones = milestones
    .filter((m) => m.goalId === activeGoal.id)
    .sort((a, b) => a.seq - b.seq);

  const goalTasks = tasks.filter(
    (t) => t.goalId === activeGoal.id && t.status !== 'cancelled'
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-workspace-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Modal Top Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              {lifeAreas.find((a) => a.id === activeGoal.lifeAreaId)?.name || 'Goal'}{' '}
              ·{' '}
              {activeGoal.goalType === 'ongoing_direction'
                ? '♾️ Ongoing Goal'
                : '🎯 Goal'}
            </p>
            <h2
              id="goal-workspace-title"
              className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              {activeGoal.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Goal Workspace"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Pipeline Bar: 1. Edit Goal -> 2. Plan (Steps) -> 3. Aage ka Process (Tasks) */}
        <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onSetDetailStep('edit')}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              detailStep === 'edit'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            1. Pura Edit Karo
          </button>
          <button
            type="button"
            onClick={() => onSetDetailStep('plan')}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              detailStep === 'plan'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            2. Plan (Steps)
          </button>
          <button
            type="button"
            onClick={() => onSetDetailStep('process')}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              detailStep === 'process'
                ? 'bg-teal-700 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            3. Aage Ka Process
          </button>
        </div>

        {/* STEP 1: PURA EDIT KARO */}
        {detailStep === 'edit' && (
          <form onSubmit={onSaveGoalEdits} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Goal Title *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => onChangeEditTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-base font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category (Health, Finance, Relationship...)
                </label>
                <select
                  value={editAreaId}
                  onChange={(e) => onChangeEditAreaId(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium"
                >
                  {activeLifeAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Goal Type
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeEditGoalType('outcome')}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                      editGoalType === 'outcome'
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    🎯 Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeEditGoalType('ongoing_direction')}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-bold border ${
                      editGoalType === 'ongoing_direction'
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    ♾️ Ongoing Goal
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Desired Outcome / System Standard (Kya chahiye?)
              </label>
              <input
                type="text"
                value={editOutcome}
                onChange={(e) => onChangeEditOutcome(e.target.value)}
                placeholder="Apne shabdon me likhein..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Personal Reason (Mere liye kyun zaruri hai?)
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => onChangeEditReason(e.target.value)}
                placeholder="Kyun zaruri hai..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                #Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_GOAL_TAGS.map((tag) => {
                  const active = editTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-xs font-mono border ${
                        active
                          ? 'bg-teal-700 text-white border-teal-700 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {formatTagLabel(tag)}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editCustomTag}
                  onChange={(e) => onChangeCustomTag(e.target.value)}
                  placeholder="Custom #tag..."
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={onAddCustomTag}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
                >
                  + Tag
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTogglePauseGoal(activeGoal)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                >
                  {activeGoal.status === 'paused' ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume Goal</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Goal</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteGoal(activeGoal.id)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {STRINGS.sync.deleteGoalBtn}
                </button>
              </div>

              <button
                type="submit"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
              >
                <span>Save Edit & Aage Plan Karo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: PLAN BANAYEIN (MILESTONES / STEPS) */}
        {detailStep === 'plan' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Step-by-Step Plan (Milestones)
                </h3>
                <p className="text-xs text-slate-500">
                  Is goal ko poora karne ke mukhya padav (checkpoints) yahan banayein.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAiSuggestMilestones(activeGoal)}
                disabled={aiBreakdownLoading}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {aiBreakdownLoading
                    ? 'Drafting...'
                    : 'AI Se Plan Suggest Karo'}
                </span>
              </button>
            </div>

            {aiSuggestedMilestones.length > 0 && (
              <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-teal-900 dark:text-teal-200">
                  AI Suggested Steps (Tap karke Plan me jodein):
                </p>
                <div className="flex flex-wrap gap-2">
                  {aiSuggestedMilestones.map((msText, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onAcceptAiMilestone(msText, i)}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 text-xs text-slate-800 dark:text-slate-200"
                    >
                      + {msText}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {goalMilestones.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500">
                  Abhi koi milestone step nahi joda gaya hai. Niche likh kar pehla step jodein.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {goalMilestones.map((ms, idx) => (
                    <div
                      key={ms.id}
                      className="p-3 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleMilestoneStatus(ms.id, ms.status)}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                            ms.status === 'done'
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-400'
                          }`}
                        >
                          {ms.status === 'done' && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            ms.status === 'done'
                              ? 'line-through text-slate-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {idx + 1}. {ms.title}
                        </span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onReorderMilestone(ms.id, 'up')}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-500 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === goalMilestones.length - 1}
                          onClick={() => onReorderMilestone(ms.id, 'down')}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-500 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => onChangeNewMilestoneTitle(e.target.value)}
                  placeholder="Naya plan step / milestone likhein..."
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newMilestoneTitle.trim()) return;
                    onCreateMilestone(newMilestoneTitle.trim());
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold whitespace-nowrap"
                >
                  + Step Jodo
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSetDetailStep('edit')}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                onClick={() => onSetDetailStep('process')}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2"
              >
                <span>Aage Ka Process (Daily Tasks)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: AAGE KA PROCESS (DAILY TASKS / EXECUTION) */}
        {detailStep === 'process' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Aage Ka Process — Daily Tasks & Next Actions
              </h3>
              <p className="text-xs text-slate-500">
                Is goal ko rozana aage badhane ke liye tasks jodein ya yahin se tick karein.
              </p>
            </div>

            {/* Add New Task Linked to this Goal */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => onChangeNewTaskTitle(e.target.value)}
                placeholder={`Agla physical action kya hai? (${STRINGS.today.taskQualityHint})`}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => onChangeNewTaskDate(e.target.value)}
                    className="min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono"
                  />
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={newTaskEstMinutes}
                    onChange={(e) =>
                      onChangeNewTaskEstMinutes(Number(e.target.value))
                    }
                    className="w-20 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-mono"
                  />
                  <span className="text-xs text-slate-500">min</span>
                </div>
                <button
                  type="button"
                  onClick={onCreateTask}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold"
                >
                  + Daily Task Jodo
                </button>
              </div>
            </div>

            {/* Linked Tasks List with AnimatedCheckButton */}
            <div className="space-y-2">
              {goalTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500">
                  Is goal me abhi koi Daily Task nahi hai. Upar se pehla action jodein.
                </div>
              ) : (
                <div className="space-y-2">
                  {goalTasks.map((task) => {
                    const isDone =
                      task.status === 'done' ||
                      completingTaskIds.includes(task.id);
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isDone
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <AnimatedCheckButton
                            checked={isDone}
                            celebrating={completingTaskIds.includes(task.id)}
                            onToggle={() =>
                              onToggleGoalTask(
                                task.id,
                                task.status === 'done'
                              )
                            }
                            ariaLabel={`Complete task ${task.title}`}
                          />
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                isDone
                                  ? 'line-through text-emerald-800 dark:text-emerald-300'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {task.title}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {task.scheduledDate || 'No date'} ·{' '}
                              {task.estMinutes || 20} min
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSetDetailStep('plan')}
                className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
              >
                ← Back to Plan
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onViewToday}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-teal-600" />
                  <span>Aaj Screen Par Dekho</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
                >
                  Done ✓
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
