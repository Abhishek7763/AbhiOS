'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckSquare,
  Clock,
  CornerDownRight,
  Infinity as InfinityIcon,
  Plus,
  Scissors,
  Sparkles,
  Tag,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import {
  AISuggestionDraft,
  Goal,
  GoalType,
  InboxItem,
  LifeArea,
} from '@/src/lib/types';
import {
  normalizeGoalTags,
  PRESET_GOAL_TAGS,
} from '@/src/lib/logic/planner';

export type FilterDestination =
  | 'goal_category'
  | 'specific_goal'
  | 'soch_vichar'
  | 'daily_task'
  | 'trash';

interface InboxFilterModalProps {
  item: InboxItem;
  today: string;
  activeLifeAreas: LifeArea[];
  activeGoals: Goal[];
  onClose: () => void;
  onSendToGoalCategory: (
    item: InboxItem,
    targetAreaId: string,
    goalMode: GoalType,
    customTitle: string,
    decisionNote: string,
    tags: string[]
  ) => void;
  onMoveToSpecificGoal: (
    item: InboxItem,
    goalId: string,
    stepType: 'milestone' | 'task',
    customTitle: string
  ) => void;
  onReturnToReflection: (
    item: InboxItem,
    targetAreaId: string | undefined,
    customTitle: string,
    decisionNote: string,
    tags: string[]
  ) => void;
  onConvertToTask: (
    item: InboxItem,
    customTitle: string,
    nextAction: string,
    estMinutes: number,
    scheduledDate: string
  ) => void;
  onMoveToTrash: (item: InboxItem) => void;
  onSplitItem: (itemId: string, lines: string[]) => void;
  onRequestAiAssist: (content: string) => Promise<{ draft: AISuggestionDraft }>;
  onCreateArea: (name: string) => LifeArea | null | undefined;
}

export function InboxFilterModal({
  item,
  today,
  activeLifeAreas,
  activeGoals,
  onClose,
  onSendToGoalCategory,
  onMoveToSpecificGoal,
  onReturnToReflection,
  onConvertToTask,
  onMoveToTrash,
  onSplitItem,
  onRequestAiAssist,
  onCreateArea,
}: InboxFilterModalProps) {
  const [filterDest, setFilterDest] =
    useState<FilterDestination>('goal_category');
  const [editedContent, setEditedContent] = useState(item.content);
  const [decisionNote, setDecisionNote] = useState(item.decisionNote || '');

  // Category & specific goal state
  const [selectedAreaId, setSelectedAreaId] = useState<string>(
    item.lifeAreaId || activeLifeAreas[0]?.id || 'area-health'
  );
  const [selectedSpecificGoalId, setSelectedSpecificGoalId] = useState<string>(
    activeGoals[0]?.id || ''
  );
  const [specificGoalStepType, setSpecificGoalStepType] = useState<
    'milestone' | 'task'
  >('milestone');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [goalMode, setGoalMode] = useState<GoalType>('outcome');
  const [goalTagsInput, setGoalTagsInput] = useState(
    item.tags && item.tags.length > 0 ? item.tags.join(' ') : ''
  );

  // Daily task state
  const [taskNextAction, setTaskNextAction] = useState(
    item.content.split('\n')[0]
  );
  const [taskEstMinutes, setTaskEstMinutes] = useState(20);
  const [taskScheduledDate, setTaskScheduledDate] = useState(today);

  // Split sub-mode
  const [showSplitBox, setShowSplitBox] = useState(false);
  const [splitText, setSplitText] = useState(
    item.content.includes('\n')
      ? item.content
      : `${item.content} - Step 1\n${item.content} - Step 2`
  );

  // AI draft state
  const [aiDraft, setAiDraft] = useState<AISuggestionDraft | null>(
    item.aiSuggestionJson || null
  );
  const [aiLoading, setAiLoading] = useState(false);

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const created = onCreateArea(newCategoryName.trim());
    if (created) {
      setSelectedAreaId(created.id);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
    }
  };

  const handleAiClick = async () => {
    setAiLoading(true);
    try {
      const res = await onRequestAiAssist(editedContent || item.content);
      setAiDraft(res.draft);
      if (res.draft.refinedTitle) {
        setEditedContent(res.draft.refinedTitle);
      }
      if (res.draft.nextAction) {
        setTaskNextAction(res.draft.nextAction);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const cleanText = editedContent.trim() || item.content;
  const parsedTags = normalizeGoalTags(goalTagsInput);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brain-dump-filter-title"
    >
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              Brain Dump Thought Filter
            </p>
            <h2
              id="brain-dump-filter-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Is Thought Ka Kya Karna Hai?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Filter Modal"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thought Wording Edit + Split / AI Helpers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Thought Text (Chahein to saaf/edit kar lein):
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowSplitBox((v) => !v)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1"
              >
                <Scissors className="w-3 h-3" />
                <span>2 Tukdon me Split</span>
              </button>
              <button
                type="button"
                onClick={handleAiClick}
                disabled={aiLoading}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-xs font-semibold text-teal-800 dark:text-teal-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>{aiLoading ? 'Soch raha...' : 'AI Suggest'}</span>
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-base text-slate-900 dark:text-slate-100"
          />

          {aiDraft && (
            <div className="rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 p-2.5 text-xs text-teal-900 dark:text-teal-200">
              AI Sujhaav: {aiDraft.explanation}
            </div>
          )}

          {showSplitBox && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Har line alag Brain Dump item ban jayegi:
              </p>
              <textarea
                rows={3}
                value={splitText}
                onChange={(e) => setSplitText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSplitBox(false)}
                  className="px-3 py-1 text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSplitItem(item.id, splitText.split('\n'));
                    onClose();
                  }}
                  className="min-h-[36px] px-3.5 py-1 rounded-lg bg-teal-700 text-white text-xs font-semibold"
                >
                  Split Karo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5 Clear Filter Destinations */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            1. Chunein Iska Kya Karna Hai:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFilterDest('goal_category')}
              className={`min-h-[54px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                filterDest === 'goal_category'
                  ? 'border-2 border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <Target className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold leading-tight mt-1">
                Naya Goal (Category me)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterDest('specific_goal')}
              className={`min-h-[54px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                filterDest === 'specific_goal'
                  ? 'border-2 border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <CornerDownRight className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold leading-tight mt-1">
                Specific Goal me Move
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterDest('daily_task')}
              className={`min-h-[54px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                filterDest === 'daily_task'
                  ? 'border-2 border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold leading-tight mt-1">
                Aaj / Kal Ka Task Banao
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterDest('soch_vichar')}
              className={`min-h-[54px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                filterDest === 'soch_vichar'
                  ? 'border-2 border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold leading-tight mt-1">
                Soch-Vichar (Wapas Brain Dump)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterDest('trash')}
              className={`min-h-[54px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                filterDest === 'trash'
                  ? 'border-2 border-rose-600 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-50/40'
              }`}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-bold leading-tight mt-1">
                Bekar Hai (Trash)
              </span>
            </button>
          </div>
        </div>

        {/* DESTINATION 1: Pick Goal Category + Goal vs Ongoing Goal */}
        {filterDest === 'goal_category' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Kis Goal Category ke andar add karna hai?
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCategoryInput((v) => !v)}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showNewCategoryInput ? 'Cancel' : '+ Naya Category'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activeLifeAreas.map((area) => {
                  const isSelected = selectedAreaId === area.id;
                  const goalCount = activeGoals.filter(
                    (g) => g.lifeAreaId === area.id
                  ).length;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setSelectedAreaId(area.id)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-teal-700 text-white border-teal-700 font-bold shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-teal-500'
                      }`}
                    >
                      <span className="text-xs truncate">{area.name}</span>
                      <span
                        className={`text-xs font-mono ml-1.5 ${
                          isSelected ? 'text-teal-100' : 'text-slate-400'
                        }`}
                      >
                        {goalCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {showNewCategoryInput && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Naya Category naam (e.g. Fitness, Study, Business)..."
                    className="flex-1 min-h-[42px] rounded-xl border border-teal-500 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Goal vs Ongoing Goal */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Goal Type Chunein:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoalMode('outcome')}
                  className={`min-h-[44px] p-2.5 rounded-xl border text-left flex items-center gap-2.5 ${
                    goalMode === 'outcome'
                      ? 'border-teal-600 bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200 font-bold shadow-2xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Target className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">
                      Goal (Target Outcome)
                    </p>
                    <p className="text-[11px] opacity-75">
                      Jise plan karke poora karna hai
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGoalMode('ongoing_direction')}
                  className={`min-h-[44px] p-2.5 rounded-xl border text-left flex items-center gap-2.5 ${
                    goalMode === 'ongoing_direction'
                      ? 'border-teal-600 bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200 font-bold shadow-2xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <InfinityIcon className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">
                      Ongoing Goal (Hamesha Chalne Wala)
                    </p>
                    <p className="text-[11px] opacity-75">
                      Life-long system jo lagataar chalta rahe
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Optional #Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-teal-600" />
                Optional #Tag:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_GOAL_TAGS.map((tag) => {
                  const isTagged = parsedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const next = isTagged
                          ? parsedTags.filter((t) => t !== tag)
                          : [...parsedTags, tag];
                        setGoalTagsInput(next.join(' '));
                      }}
                      className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-xs font-mono border ${
                        isTagged
                          ? 'bg-teal-700 text-white border-teal-700 font-semibold'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* DESTINATION 2: Move to Specific Existing Goal */}
        {filterDest === 'specific_goal' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Kis Specific Goal ke andar move karna hai?
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {activeGoals.map((goal) => {
                  const areaName =
                    activeLifeAreas.find((a) => a.id === goal.lifeAreaId)?.name ||
                    'Goal';
                  const isSelected = selectedSpecificGoalId === goal.id;
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedSpecificGoalId(goal.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-2 border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 font-bold'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block">
                          {areaName}
                        </span>
                        <span className="text-xs sm:text-sm truncate block">
                          {goal.title}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-teal-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Goal ke andar kis roop me jodein?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSpecificGoalStepType('milestone')}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold text-left ${
                    specificGoalStepType === 'milestone'
                      ? 'border-teal-600 bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  2. Plan Step (Milestone)
                </button>
                <button
                  type="button"
                  onClick={() => setSpecificGoalStepType('task')}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold text-left ${
                    specificGoalStepType === 'task'
                      ? 'border-teal-600 bg-white dark:bg-slate-900 text-teal-900 dark:text-teal-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  3. Aage Ka Process (Daily Task)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DESTINATION 3: Soch-Vichar (Return to Brain Dump) */}
        {filterDest === 'soch_vichar' && (
          <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              Abhi pakka nahi hai? Koi baat nahi — ise wapas Brain Dump me rakhein taaki baad me aaram se soch-vichar kar sakein.
            </p>
            <input
              type="text"
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Optional note (e.g. Agle hafte sochenge)..."
              className="w-full rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm"
            />
          </div>
        )}

        {/* DESTINATION 4: Convert to Daily Task */}
        {filterDest === 'daily_task' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Concrete Action Step:
              </label>
              <input
                type="text"
                value={taskNextAction}
                onChange={(e) => setTaskNextAction(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kab Karna Hai?
                </label>
                <input
                  type="date"
                  value={taskScheduledDate}
                  onChange={(e) => setTaskScheduledDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Est. Minutes
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={taskEstMinutes}
                  onChange={(e) => setTaskEstMinutes(Number(e.target.value))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* DESTINATION 5: Trash */}
        {filterDest === 'trash' && (
          <div className="rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-4 text-xs text-rose-900 dark:text-teal-200">
            Ye thought bekar hai to ise seedha Trash me bhej dein. Aap kabhi bhi Trash se wapas nikal sakte hain.
          </div>
        )}

        {/* Modal Footer Action Button */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          {filterDest === 'goal_category' && (
            <button
              type="button"
              onClick={() =>
                onSendToGoalCategory(
                  item,
                  selectedAreaId,
                  goalMode,
                  cleanText,
                  decisionNote,
                  parsedTags
                )
              }
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
            >
              <span>
                {activeLifeAreas.find((a) => a.id === selectedAreaId)?.name ||
                  'Goal'}{' '}
                Category me Add Karo
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {filterDest === 'specific_goal' && (
            <button
              type="button"
              onClick={() =>
                onMoveToSpecificGoal(
                  item,
                  selectedSpecificGoalId || activeGoals[0]?.id || '',
                  specificGoalStepType,
                  cleanText
                )
              }
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
            >
              <span>Chune Gaye Goal me Move Karo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {filterDest === 'soch_vichar' && (
            <button
              type="button"
              onClick={() =>
                onReturnToReflection(
                  item,
                  selectedAreaId,
                  cleanText,
                  decisionNote,
                  parsedTags
                )
              }
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
            >
              <Clock className="w-4 h-4" />
              <span>Wapas Brain Dump me Rakho</span>
            </button>
          )}

          {filterDest === 'daily_task' && (
            <button
              type="button"
              onClick={() =>
                onConvertToTask(
                  item,
                  cleanText,
                  taskNextAction,
                  taskEstMinutes,
                  taskScheduledDate
                )
              }
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Daily Task me Add Karo</span>
            </button>
          )}

          {filterDest === 'trash' && (
            <button
              type="button"
              onClick={() => onMoveToTrash(item)}
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold flex items-center gap-2 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Trash me Daalo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
