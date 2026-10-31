'use client';

import React, { useMemo, useState } from 'react';
import { useGoalOs } from '@/src/context/goal-os-context';
import {
  computeLifeBalanceSnapshot,
  normalizeGoalTags,
} from '@/src/lib/logic/planner';
import { Goal, GoalStatus, GoalType } from '@/src/lib/types';
import { playCompletionCelebrationSound } from '@/src/components/animated-check-button';

import {
  GoalsHeaderTabs,
  TopGoalViewMode,
} from '@/src/components/goals/goals-header-tabs';
import { GoalsCategoriesGrid } from '@/src/components/goals/goals-categories-grid';
import { GoalsOngoingSection } from '@/src/components/goals/goals-ongoing-section';
import { GoalsCandidatesSection } from '@/src/components/goals/goals-candidates-section';
import { GoalsSomedaySection } from '@/src/components/goals/goals-someday-section';
import { GoalsListSection } from '@/src/components/goals/goals-list-section';
import { GoalsAddDrawer } from '@/src/components/goals/goals-add-drawer';
import { GoalsWorkspaceModal } from '@/src/components/goals/goals-workspace-modal';

type GoalDetailStep = 'edit' | 'plan' | 'process';

export function GoalsView() {
  const {
    state,
    today,
    createDirectGoal,
    updateGoal,
    deleteGoal,
    createMilestone,
    updateMilestone,
    reorderMilestone,
    createTask,
    completeTask,
    reopenTask,
    rescheduleTask,
    createLifeArea,
    updateLifeArea,
    requestAiSuggestion,
    setActiveTab,
  } = useGoalOs();

  const [showBalanceSnapshot, setShowBalanceSnapshot] = useState(false);
  const [viewMode, setViewMode] = useState<TopGoalViewMode>('categories');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('area-health');

  // Active Goal Workspace Modal
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [detailStep, setDetailStep] = useState<GoalDetailStep>('edit');

  // Edit Fields inside Goal Workspace
  const [editTitle, setEditTitle] = useState('');
  const [editAreaId, setEditAreaId] = useState('');
  const [editGoalType, setEditGoalType] = useState<GoalType>('outcome');
  const [editStatus, setEditStatus] = useState<GoalStatus>('active');
  const [editOutcome, setEditOutcome] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editTradeoffs, setEditTradeoffs] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editCustomTag, setEditCustomTag] = useState('');

  // Plan (Milestones) & Process (Tasks)
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [aiBreakdownLoading, setAiBreakdownLoading] = useState(false);
  const [aiSuggestedMilestones, setAiSuggestedMilestones] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEstMinutes, setNewTaskEstMinutes] = useState(25);
  const [newTaskDate, setNewTaskDate] = useState(today);
  const [completingTaskIds, setCompletingTaskIds] = useState<string[]>([]);

  // Add Goal / Category Drawer
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMode, setAddMode] = useState<'goal' | 'category'>('goal');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalAreaId, setNewGoalAreaId] = useState('area-health');
  const [newGoalType, setNewGoalType] = useState<GoalType>('outcome');
  const [newGoalOutcome, setNewGoalOutcome] = useState('');
  const [newGoalReason, setNewGoalReason] = useState('');

  // Rename / Edit Categories Mode
  const [editingCategoriesMode, setEditingCategoriesMode] = useState(false);
  const [renamingAreaId, setRenamingAreaId] = useState<string | null>(null);
  const [renamingAreaText, setRenamingAreaText] = useState('');

  const activeLifeAreas = useMemo(
    () => state.lifeAreas.filter((a) => a.status === 'active'),
    [state.lifeAreas]
  );

  const visibleGoals = useMemo(
    () =>
      state.goals.filter(
        (g) => g.status === 'active' || g.status === 'candidate'
      ),
    [state.goals]
  );

  const lifeBalance = useMemo(
    () =>
      computeLifeBalanceSnapshot(
        activeLifeAreas,
        state.goals,
        state.tasks
      ),
    [activeLifeAreas, state.goals, state.tasks]
  );

  const ongoingGoals = useMemo(
    () => visibleGoals.filter((g) => g.goalType === 'ongoing_direction'),
    [visibleGoals]
  );

  const candidateGoals = useMemo(
    () => state.goals.filter((g) => g.status === 'candidate'),
    [state.goals]
  );

  const somedayGoals = useMemo(
    () =>
      state.goals.filter(
        (g) => g.status === 'paused' || (g.status as string) === 'someday'
      ),
    [state.goals]
  );

  const selectedArea = useMemo(
    () =>
      activeLifeAreas.find((a) => a.id === selectedAreaId) ||
      activeLifeAreas[0] ||
      null,
    [activeLifeAreas, selectedAreaId]
  );

  const selectedCategoryGoals = useMemo(() => {
    if (!selectedArea) return visibleGoals;
    return visibleGoals.filter((g) => g.lifeAreaId === selectedArea.id);
  }, [visibleGoals, selectedArea]);

  const activeGoal = useMemo(
    () => state.goals.find((g) => g.id === activeGoalId) || null,
    [state.goals, activeGoalId]
  );

  const openGoalWorkspace = (
    goal: Goal,
    initialStep: GoalDetailStep = 'edit'
  ) => {
    setActiveGoalId(goal.id);
    setDetailStep(initialStep);
    setEditTitle(goal.title);
    setEditAreaId(goal.lifeAreaId);
    setEditGoalType(goal.goalType);
    setEditStatus(goal.status);
    setEditOutcome(goal.desiredOutcome || '');
    setEditReason(goal.purposeReason || '');
    setEditTradeoffs(goal.tradeoffs || '');
    setEditTargetDate(goal.targetDate || '');
    setEditTags(normalizeGoalTags(goal.tags || []));
    setEditCustomTag('');
    setAiSuggestedMilestones([]);
    setNewMilestoneTitle('');
    setNewTaskTitle('');
    setNewTaskDate(today);
  };

  const handleSaveGoalEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGoal || !editTitle.trim()) return;
    updateGoal(activeGoal.id, {
      title: editTitle.trim(),
      lifeAreaId: editAreaId,
      goalType: editGoalType,
      status: editStatus === 'candidate' ? 'active' : editStatus,
      desiredOutcome: editOutcome.trim(),
      purposeReason: editReason.trim(),
      tradeoffs: editTradeoffs.trim(),
      targetDate:
        editGoalType === 'ongoing_direction' ? null : editTargetDate || null,
      tags: normalizeGoalTags(editTags),
    });
    setDetailStep('plan');
  };

  const handleAiSuggestMilestones = async (goal: Goal) => {
    setAiBreakdownLoading(true);
    try {
      const { draft } = await requestAiSuggestion(
        'goal_gate_assist',
        goal.title
      );
      if (draft.subItems && draft.subItems.length > 0) {
        setAiSuggestedMilestones(draft.subItems);
      }
    } finally {
      setAiBreakdownLoading(false);
    }
  };

  const handleCreateGoalOrCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === 'category') {
      if (!newCategoryName.trim()) return;
      const created = createLifeArea(
        newCategoryName.trim(),
        newCategoryDesc.trim()
      );
      if (created) {
        setSelectedAreaId(created.id);
      }
      setNewCategoryName('');
      setNewCategoryDesc('');
      setShowAddMenu(false);
      return;
    }

    if (!newGoalTitle.trim()) return;
    const targetArea =
      newGoalAreaId || selectedArea?.id || activeLifeAreas[0]?.id || 'area-health';
    const createdGoal = createDirectGoal({
      title: newGoalTitle.trim(),
      lifeAreaId: targetArea,
      goalType: newGoalType,
      desiredOutcome: newGoalOutcome.trim() || newGoalTitle.trim(),
      purposeReason:
        newGoalReason.trim() || 'Meri life direction aur sukoon ke liye',
      status: 'active',
    });
    setSelectedAreaId(targetArea);
    setNewGoalTitle('');
    setNewGoalOutcome('');
    setNewGoalReason('');
    setShowAddMenu(false);
    openGoalWorkspace(createdGoal, 'plan');
  };

  const handleToggleGoalTask = (taskId: string, isDone: boolean) => {
    if (isDone) {
      reopenTask(taskId);
      return;
    }
    if (completingTaskIds.includes(taskId)) return;
    playCompletionCelebrationSound();
    setCompletingTaskIds((prev) => [...prev, taskId]);
    setTimeout(() => {
      completeTask(taskId);
      setCompletingTaskIds((prev) => prev.filter((id) => id !== taskId));
    }, 450);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 1. Header + Top Switch: "Goals" vs "Ongoing Goals" */}
      <GoalsHeaderTabs
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        showBalanceSnapshot={showBalanceSnapshot}
        onToggleBalanceSnapshot={() => setShowBalanceSnapshot((v) => !v)}
        lifeBalance={lifeBalance}
        activeLifeAreas={activeLifeAreas}
        ongoingGoalsCount={ongoingGoals.length}
        candidateGoalsCount={candidateGoals.length}
        somedayGoalsCount={somedayGoals.length}
        onSelectAreaFromBalance={(areaId) => {
          setViewMode('categories');
          setSelectedAreaId(areaId);
        }}
      />

      {/* Mode A: Categories stack */}
      {viewMode === 'categories' && (
        <GoalsCategoriesGrid
          activeLifeAreas={activeLifeAreas}
          visibleGoals={visibleGoals}
          selectedAreaId={selectedArea?.id || ''}
          onSelectAreaId={setSelectedAreaId}
          editingCategoriesMode={editingCategoriesMode}
          renamingAreaId={renamingAreaId}
          renamingAreaText={renamingAreaText}
          onStartRenameArea={(areaId, name) => {
            setRenamingAreaId(areaId);
            setRenamingAreaText(name);
          }}
          onChangeRenameText={setRenamingAreaText}
          onSaveRenameArea={(areaId) => {
            if (renamingAreaText.trim()) {
              updateLifeArea(areaId, { name: renamingAreaText.trim() });
            }
            setRenamingAreaId(null);
          }}
          onCancelRenameArea={() => setRenamingAreaId(null)}
        />
      )}

      {/* Mode B: Ongoing Goals list */}
      {viewMode === 'ongoing' && (
        <GoalsOngoingSection
          ongoingGoals={ongoingGoals}
          lifeAreas={state.lifeAreas}
          onOpenGoalWorkspace={openGoalWorkspace}
        />
      )}

      {/* Mode C: Candidates list */}
      {viewMode === 'candidates' && (
        <GoalsCandidatesSection
          candidateGoals={candidateGoals}
          lifeAreas={state.lifeAreas}
          onOpenGoalWorkspace={openGoalWorkspace}
        />
      )}

      {/* Mode D: Someday / Maybe list */}
      {viewMode === 'someday' && (
        <GoalsSomedaySection
          somedayGoals={somedayGoals}
          lifeAreas={state.lifeAreas}
          onActivateGoal={(goalId) => updateGoal(goalId, { status: 'active' })}
          onOpenGoalWorkspace={openGoalWorkspace}
        />
      )}

      {/* Selected Category Goals List (Arrow Down view) */}
      {viewMode === 'categories' && selectedArea && (
        <GoalsListSection
          selectedArea={selectedArea}
          selectedCategoryGoals={selectedCategoryGoals}
          milestones={state.milestones}
          tasks={state.tasks}
          today={today}
          editingCategoriesMode={editingCategoriesMode}
          onOpenGoalWorkspace={openGoalWorkspace}
          onOpenAddGoalDrawer={() => {
            setAddMode('goal');
            setNewGoalAreaId(selectedArea.id);
            setShowAddMenu(true);
          }}
          onToggleEditingCategories={() => setEditingCategoriesMode((v) => !v)}
          onRescheduleTaskToday={(taskId) => rescheduleTask(taskId, today)}
        />
      )}

      {/* Add New Goal / Category Drawer */}
      <GoalsAddDrawer
        showAddMenu={showAddMenu}
        addMode={addMode}
        onSetAddMode={setAddMode}
        onClose={() => setShowAddMenu(false)}
        onSubmit={handleCreateGoalOrCategory}
        newCategoryName={newCategoryName}
        onChangeCategoryName={setNewCategoryName}
        newCategoryDesc={newCategoryDesc}
        onChangeCategoryDesc={setNewCategoryDesc}
        newGoalTitle={newGoalTitle}
        onChangeGoalTitle={setNewGoalTitle}
        newGoalAreaId={newGoalAreaId}
        onChangeGoalAreaId={setNewGoalAreaId}
        newGoalType={newGoalType}
        onChangeGoalType={setNewGoalType}
        activeLifeAreas={activeLifeAreas}
      />

      {/* Full Goal Workspace Modal (Edit -> Plan -> Process) */}
      <GoalsWorkspaceModal
        activeGoal={activeGoal}
        onClose={() => setActiveGoalId(null)}
        lifeAreas={state.lifeAreas}
        activeLifeAreas={activeLifeAreas}
        milestones={state.milestones}
        tasks={state.tasks}
        today={today}
        detailStep={detailStep}
        onSetDetailStep={setDetailStep}
        editTitle={editTitle}
        onChangeEditTitle={setEditTitle}
        editAreaId={editAreaId}
        onChangeEditAreaId={setEditAreaId}
        editGoalType={editGoalType}
        onChangeEditGoalType={setEditGoalType}
        editOutcome={editOutcome}
        onChangeEditOutcome={setEditOutcome}
        editReason={editReason}
        onChangeEditReason={setEditReason}
        editTags={editTags}
        onToggleTag={(tag) =>
          setEditTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
          )
        }
        editCustomTag={editCustomTag}
        onChangeCustomTag={setEditCustomTag}
        onAddCustomTag={() => {
          const clean = normalizeGoalTags([editCustomTag]);
          if (clean.length > 0) {
            setEditTags((prev) => normalizeGoalTags([...prev, ...clean]));
            setEditCustomTag('');
          }
        }}
        onSaveGoalEdits={handleSaveGoalEdits}
        onTogglePauseGoal={(goal) => {
          updateGoal(goal.id, {
            status: goal.status === 'paused' ? 'active' : 'paused',
          });
          setActiveGoalId(null);
        }}
        onDeleteGoal={(goalId) => {
          deleteGoal(goalId);
          setActiveGoalId(null);
        }}
        newMilestoneTitle={newMilestoneTitle}
        onChangeNewMilestoneTitle={setNewMilestoneTitle}
        onCreateMilestone={(title) => {
          if (!activeGoal) return;
          createMilestone({ goalId: activeGoal.id, title });
          setNewMilestoneTitle('');
        }}
        onToggleMilestoneStatus={(milestoneId, currentStatus) =>
          updateMilestone(milestoneId, {
            status: currentStatus === 'done' ? 'todo' : 'done',
          })
        }
        onReorderMilestone={(milestoneId, direction) =>
          reorderMilestone(milestoneId, direction)
        }
        aiBreakdownLoading={aiBreakdownLoading}
        aiSuggestedMilestones={aiSuggestedMilestones}
        onAiSuggestMilestones={handleAiSuggestMilestones}
        onAcceptAiMilestone={(title, idx) => {
          if (!activeGoal) return;
          createMilestone({ goalId: activeGoal.id, title });
          setAiSuggestedMilestones((prev) => prev.filter((_, i) => i !== idx));
        }}
        newTaskTitle={newTaskTitle}
        onChangeNewTaskTitle={setNewTaskTitle}
        newTaskDate={newTaskDate}
        onChangeNewTaskDate={setNewTaskDate}
        newTaskEstMinutes={newTaskEstMinutes}
        onChangeNewTaskEstMinutes={setNewTaskEstMinutes}
        onCreateTask={() => {
          if (!activeGoal || !newTaskTitle.trim()) return;
          createTask({
            goalId: activeGoal.id,
            title: newTaskTitle.trim(),
            nextAction: newTaskTitle.trim(),
            scheduledDate: newTaskDate || today,
            estMinutes: newTaskEstMinutes,
          });
          setNewTaskTitle('');
        }}
        completingTaskIds={completingTaskIds}
        onToggleGoalTask={handleToggleGoalTask}
        onViewToday={() => {
          setActiveGoalId(null);
          setActiveTab('today');
        }}
      />
    </div>
  );
}
