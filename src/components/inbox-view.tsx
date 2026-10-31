'use client';

import React, { useMemo, useState } from 'react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { GoalType, InboxItem } from '@/src/lib/types';
import { suggestContextualBrainDumpMatch } from '@/src/lib/logic/planner';

import { InboxCaptureBox } from '@/src/components/inbox/inbox-capture-box';
import { InboxItemRow } from '@/src/components/inbox/inbox-item-row';
import { InboxFilterModal } from '@/src/components/inbox/inbox-filter-modal';
import { InboxTrashDrawer } from '@/src/components/inbox/inbox-trash-drawer';

export function InboxView() {
  const {
    state,
    today,
    quickCapture,
    updateInboxItem,
    restoreInboxItem,
    splitInboxItem,
    convertInboxToEntity,
    moveInboxToExistingGoal,
    captureAndMoveToGoal,
    createDirectGoal,
    createLifeArea,
    requestAiSuggestion,
    setActiveTab,
    showToast,
  } = useGoalOs();

  // 1. Capture box state
  const [captureText, setCaptureText] = useState('');
  const [inputCategoryOverride, setInputCategoryOverride] = useState<
    string | null
  >(null);
  const [inputGoalOverride, setInputGoalOverride] = useState<string>('');
  const [inputGoalStepType, setInputGoalStepType] = useState<
    'milestone' | 'task'
  >('milestone');
  const [inputGoalType, setInputGoalType] = useState<GoalType>('outcome');
  const [showInputNewCategory, setShowInputNewCategory] = useState(false);
  const [inputNewCategoryName, setInputNewCategoryName] = useState('');
  const [showTrashView, setShowTrashView] = useState(false);

  // 2. Inline item contextual menu state
  const [expandedContextItemId, setExpandedContextItemId] = useState<
    string | null
  >(null);
  const [inlineTargetGoalId, setInlineTargetGoalId] = useState<string>('');
  const [inlineStepType, setInlineStepType] = useState<'milestone' | 'task'>(
    'milestone'
  );
  const [inlineGoalType, setInlineGoalType] = useState<GoalType>('outcome');

  // 3. Filter modal state
  const [filteringId, setFilteringId] = useState<string | null>(null);

  const activeLifeAreas = useMemo(
    () => state.lifeAreas.filter((a) => a.status === 'active'),
    [state.lifeAreas]
  );

  const activeGoals = useMemo(
    () => state.goals.filter((g) => g.status === 'active'),
    [state.goals]
  );

  const brainDumpItems = useMemo(
    () =>
      state.inboxItems.filter(
        (i) => i.status === 'new' || i.status === 'someday'
      ),
    [state.inboxItems]
  );

  const trashedItems = useMemo(
    () => state.inboxItems.filter((i) => i.status === 'trash'),
    [state.inboxItems]
  );

  const activeFilteringItem = useMemo(
    () => state.inboxItems.find((i) => i.id === filteringId) || null,
    [state.inboxItems, filteringId]
  );

  // Smart Contextual Detection on the text being typed
  const inputSuggestion = useMemo(() => {
    return suggestContextualBrainDumpMatch(
      captureText,
      activeLifeAreas,
      activeGoals
    );
  }, [captureText, activeLifeAreas, activeGoals]);

  const effectiveInputCategoryId =
    inputCategoryOverride !== null
      ? inputCategoryOverride
      : inputSuggestion.suggestedAreaId || '';

  const effectiveInputGoalId =
    inputGoalOverride ||
    inputSuggestion.suggestedGoalId ||
    activeGoals[0]?.id ||
    '';

  const selectedInputAreaObj = activeLifeAreas.find(
    (a) => a.id === effectiveInputCategoryId
  );

  // Capture handlers
  const handleRelaxSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureText.trim()) return;

    quickCapture(captureText.trim(), 'manual', {
      lifeAreaId: effectiveInputCategoryId || undefined,
    });
    setCaptureText('');
    setInputCategoryOverride(null);
    setInputGoalOverride('');
    setShowInputNewCategory(false);
  };

  const handleInputMoveToTrash = () => {
    if (!captureText.trim()) return;
    quickCapture(captureText.trim(), 'manual', {
      status: 'trash',
      decisionNote: 'Typed & immediately trashed',
    });
    setCaptureText('');
    setInputCategoryOverride(null);
    setInputGoalOverride('');
  };

  const handleCreateInputNewCategory = () => {
    if (!inputNewCategoryName.trim()) return;
    const created = createLifeArea(inputNewCategoryName.trim());
    if (created) {
      setInputCategoryOverride(created.id);
      setInputNewCategoryName('');
      setShowInputNewCategory(false);
    }
  };

  const handleInputCreateCategoryGoal = () => {
    if (!captureText.trim() || !effectiveInputCategoryId) return;
    createDirectGoal({
      title: captureText.trim(),
      lifeAreaId: effectiveInputCategoryId,
      goalType: inputGoalType,
      desiredOutcome: captureText.trim(),
      purposeReason: 'Direct category goal from Brain Dump',
      status: 'active',
    });
    setCaptureText('');
    setInputCategoryOverride(null);
    setInputGoalOverride('');
    setActiveTab('goals');
  };

  const handleInputMoveToSpecificGoal = () => {
    if (!captureText.trim() || !effectiveInputGoalId) return;
    captureAndMoveToGoal(
      captureText.trim(),
      effectiveInputGoalId,
      inputGoalStepType
    );
    setCaptureText('');
    setInputCategoryOverride(null);
    setInputGoalOverride('');
    setActiveTab('goals');
  };

  // Inline item row handlers
  const toggleItemContextMenu = (item: InboxItem) => {
    if (expandedContextItemId === item.id) {
      setExpandedContextItemId(null);
      return;
    }
    setExpandedContextItemId(item.id);
    const match = suggestContextualBrainDumpMatch(
      item.content,
      activeLifeAreas,
      activeGoals
    );
    setInlineTargetGoalId(
      match.suggestedGoalId ||
        activeGoals.find((g) => g.lifeAreaId === item.lifeAreaId)?.id ||
        activeGoals[0]?.id ||
        ''
    );
    setInlineStepType('milestone');
    setInlineGoalType('outcome');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-8">
      {/* 1. Brain Dump Input Box & Quick Filter Menu */}
      <InboxCaptureBox
        captureText={captureText}
        onChangeCaptureText={setCaptureText}
        onSubmitCapture={handleRelaxSave}
        inputSuggestion={inputSuggestion}
        effectiveInputCategoryId={effectiveInputCategoryId}
        onSelectCategory={setInputCategoryOverride}
        activeLifeAreas={activeLifeAreas}
        showInputNewCategory={showInputNewCategory}
        onToggleInputNewCategory={() => setShowInputNewCategory((v) => !v)}
        inputNewCategoryName={inputNewCategoryName}
        onChangeInputNewCategoryName={setInputNewCategoryName}
        onCreateInputNewCategory={handleCreateInputNewCategory}
        selectedInputAreaObj={selectedInputAreaObj}
        inputGoalType={inputGoalType}
        onChangeInputGoalType={setInputGoalType}
        onCreateCategoryGoal={handleInputCreateCategoryGoal}
        activeGoals={activeGoals}
        effectiveInputGoalId={effectiveInputGoalId}
        onSelectSpecificGoal={setInputGoalOverride}
        inputGoalStepType={inputGoalStepType}
        onChangeInputGoalStepType={setInputGoalStepType}
        onMoveToSpecificGoal={handleInputMoveToSpecificGoal}
        onDirectMoveToTrash={handleInputMoveToTrash}
        trashedCount={trashedItems.length}
        showTrashView={showTrashView}
        onToggleTrashView={() => setShowTrashView((v) => !v)}
        onShowToast={showToast}
      />

      {/* 2. Brain Dump List OR Trashed List */}
      {!showTrashView ? (
        <section className="space-y-4" aria-label="Brain Dump List">
          <div className="flex items-baseline justify-between px-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Captured Thoughts
              </h2>
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {brainDumpItems.length}
              </span>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
              Select an item to categorize, move to a goal, or discard
            </span>
          </div>

          {brainDumpItems.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-2">
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Brain Dump bilkul khali aur shant hai.
              </p>
              <p className="text-sm text-slate-500">
                Upar bade box me kuch bhi likh kar &ldquo;Relax&rdquo; dabayein — wo niche list me aa jayega.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs divide-y divide-slate-200/80 dark:divide-slate-800 overflow-hidden">
              {brainDumpItems.map((item, idx) => {
                const assignedArea = state.lifeAreas.find(
                  (a) => a.id === item.lifeAreaId
                );
                const isContextOpen = expandedContextItemId === item.id;

                return (
                  <InboxItemRow
                    key={item.id}
                    item={item}
                    index={idx}
                    assignedArea={assignedArea}
                    isContextOpen={isContextOpen}
                    onToggleContextMenu={() => toggleItemContextMenu(item)}
                    onOpenFilterModal={() => setFilteringId(item.id)}
                    onMoveToTrash={() =>
                      updateInboxItem(item.id, {
                        status: 'trash',
                        decisionNote: 'Bekar thought — Trash me bheja gaya',
                      })
                    }
                    activeLifeAreas={activeLifeAreas}
                    activeGoals={activeGoals}
                    inlineTargetGoalId={inlineTargetGoalId}
                    onSelectInlineTargetGoal={setInlineTargetGoalId}
                    inlineStepType={inlineStepType}
                    onChangeInlineStepType={setInlineStepType}
                    inlineGoalType={inlineGoalType}
                    onChangeInlineGoalType={setInlineGoalType}
                    onAssignCategory={(areaId) => {
                      updateInboxItem(item.id, { lifeAreaId: areaId });
                      const firstGoalInArea = activeGoals.find(
                        (g) => g.lifeAreaId === areaId
                      );
                      if (firstGoalInArea) {
                        setInlineTargetGoalId(firstGoalInArea.id);
                      }
                    }}
                    onSendToGoalCategory={(areaId, goalType) => {
                      convertInboxToEntity(item.id, 'goal_candidate', {
                        title: item.content.split('\n')[0],
                        desiredOutcome: item.content,
                        purposeReason: 'Brain Dump se 1-tap me banaya gaya goal',
                        lifeAreaId: areaId,
                        goalType,
                        tags: item.tags || [],
                        directActivate: true,
                      });
                      setExpandedContextItemId(null);
                      setActiveTab('goals');
                    }}
                    onMoveToSpecificGoal={(goalId, stepType) => {
                      if (!goalId) return;
                      moveInboxToExistingGoal(item.id, goalId, stepType);
                      setExpandedContextItemId(null);
                      setActiveTab('goals');
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <InboxTrashDrawer
          trashedItems={trashedItems}
          onRestoreItem={restoreInboxItem}
          onBackToBrainDump={() => setShowTrashView(false)}
        />
      )}

      {/* 3. Full "Filter & Decide" Modal */}
      {activeFilteringItem && (
        <InboxFilterModal
          item={activeFilteringItem}
          today={today}
          activeLifeAreas={activeLifeAreas}
          activeGoals={activeGoals}
          onClose={() => setFilteringId(null)}
          onSendToGoalCategory={(
            item,
            targetAreaId,
            goalMode,
            customTitle,
            decisionNote,
            tags
          ) => {
            convertInboxToEntity(item.id, 'goal_candidate', {
              title: customTitle.split('\n')[0],
              desiredOutcome: customTitle,
              purposeReason:
                decisionNote.trim() || 'Brain Dump se filter karke chuna gaya goal',
              lifeAreaId: targetAreaId,
              goalType: goalMode,
              tags,
              directActivate: true,
            });
            setFilteringId(null);
            setExpandedContextItemId(null);
            setActiveTab('goals');
          }}
          onMoveToSpecificGoal={(item, goalId, stepType, customTitle) => {
            moveInboxToExistingGoal(item.id, goalId, stepType, customTitle);
            setFilteringId(null);
            setExpandedContextItemId(null);
            setActiveTab('goals');
          }}
          onReturnToReflection={(
            item,
            targetAreaId,
            customTitle,
            decisionNote,
            tags
          ) => {
            updateInboxItem(item.id, {
              content: customTitle,
              status: 'someday',
              lifeAreaId: targetAreaId || item.lifeAreaId || null,
              tags,
              decisionNote:
                decisionNote.trim() || 'Baad me soch-vichar ke liye rakha gaya',
            });
            setFilteringId(null);
            setExpandedContextItemId(null);
          }}
          onConvertToTask={(
            item,
            customTitle,
            nextAction,
            estMinutes,
            scheduledDate
          ) => {
            convertInboxToEntity(item.id, 'task', {
              title: customTitle.split('\n')[0],
              nextAction: nextAction.trim() || customTitle,
              estMinutes,
              scheduledDate: scheduledDate || today,
              goalId: null,
            });
            setFilteringId(null);
            setExpandedContextItemId(null);
          }}
          onMoveToTrash={(item) => {
            updateInboxItem(item.id, {
              status: 'trash',
              decisionNote: 'Bekar thought — Trash me bheja gaya',
            });
            setFilteringId(null);
            setExpandedContextItemId(null);
          }}
          onSplitItem={splitInboxItem}
          onRequestAiAssist={(content) =>
            requestAiSuggestion('inbox_clarify', content)
          }
          onCreateArea={createLifeArea}
        />
      )}
    </div>
  );
}
