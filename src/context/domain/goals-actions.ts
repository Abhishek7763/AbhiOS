import React from 'react';
import {
  AppStateData,
  Goal,
  InboxItem,
  LifeArea,
  Milestone,
  Project,
  Routine,
  Task,
} from '@/src/lib/types';
import { addDays } from '@/src/lib/logic/dates';
import { STRINGS } from '@/src/lib/strings';
import { ToastMessage } from '@/src/context/types';
import { makeId } from './helpers';

export interface GoalsActionsDeps {
  state: AppStateData;
  setState: React.Dispatch<React.SetStateAction<AppStateData>>;
  today: string;
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
  setActiveQualityGateGoalId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function buildGoalsActions({
  state,
  setState,
  today,
  showToast,
  setActiveQualityGateGoalId,
}: GoalsActionsDeps) {
  const createGoalCandidate = (fields: Partial<Goal>): Goal => {
    const nowIso = new Date().toISOString();
    const newGoal: Goal = {
      id: makeId('goal'),
      userId: state.settings.userId,
      lifeAreaId:
        fields.lifeAreaId || state.lifeAreas[0]?.id || 'area-personal',
      title: fields.title || 'Naya Goal Candidate',
      desiredOutcome: fields.desiredOutcome || '',
      purposeReason: fields.purposeReason || '',
      ownershipReflection: fields.ownershipReflection || '',
      evidenceOfProgress: fields.evidenceOfProgress || '',
      controlNotes: fields.controlNotes || '',
      tradeoffs: fields.tradeoffs || '',
      capacityNotes: fields.capacityNotes || '',
      tags: fields.tags || [],
      goalType: fields.goalType || 'outcome',
      status: 'candidate',
      targetDate: fields.targetDate || null,
      reviewDate: fields.reviewDate || addDays(today, 7),
      reviewCadence: fields.reviewCadence || 'weekly',
      originInboxItemId: fields.originInboxItemId || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({
      ...prev,
      goals: [newGoal, ...prev.goals],
    }));
    setActiveQualityGateGoalId(newGoal.id);
    return newGoal;
  };

  const createDirectGoal = (fields: Partial<Goal>): Goal => {
    const nowIso = new Date().toISOString();
    const newGoal: Goal = {
      id: makeId('goal'),
      userId: state.settings.userId,
      lifeAreaId:
        fields.lifeAreaId || state.lifeAreas[0]?.id || 'area-health',
      title: (fields.title || 'Naya Ongoing Goal').trim(),
      desiredOutcome: fields.desiredOutcome?.trim() || '',
      purposeReason: fields.purposeReason?.trim() || '',
      ownershipReflection: fields.ownershipReflection?.trim() || '',
      evidenceOfProgress: fields.evidenceOfProgress?.trim() || '',
      controlNotes: fields.controlNotes?.trim() || '',
      tradeoffs: fields.tradeoffs?.trim() || '',
      capacityNotes: fields.capacityNotes?.trim() || '',
      tags: fields.tags || [],
      goalType: fields.goalType || 'ongoing_direction',
      status: fields.status || 'active',
      targetDate: fields.targetDate || null,
      reviewDate: fields.reviewDate || addDays(today, 7),
      reviewCadence: fields.reviewCadence || 'weekly',
      originInboxItemId: fields.originInboxItemId || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({
      ...prev,
      goals: [newGoal, ...prev.goals],
    }));
    showToast(
      newGoal.goalType === 'ongoing_direction'
        ? 'Ongoing Goal set ho gaya — ye hamesha active system ki tarah chalega!'
        : 'Goal save ho gaya!',
      'success'
    );
    return newGoal;
  };

  const updateGoal = (id: string, patch: Partial<Goal>) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) =>
        g.id === id ? { ...g, ...patch, updatedAt: nowIso } : g
      ),
    }));
    showToast('Goal update ho gaya.', 'success');
  };

  const deleteGoal = (id: string) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
      milestones: prev.milestones.filter((m) => m.goalId !== id),
      tasks: prev.tasks.map((t) =>
        t.goalId === id
          ? { ...t, goalId: null, milestoneId: null, updatedAt: nowIso }
          : t
      ),
      projects: prev.projects.map((p) =>
        p.goalId === id ? { ...p, goalId: null, updatedAt: nowIso } : p
      ),
      routines: prev.routines.map((r) =>
        r.goalId === id ? { ...r, goalId: null, updatedAt: nowIso } : r
      ),
    }));
    setActiveQualityGateGoalId((curr) => (curr === id ? null : curr));
    showToast(STRINGS.sync.goalDeletedToast, 'info');
  };

  const resolveGoalCandidateGate = (
    goalId: string,
    decision:
      | 'accept'
      | 'refine'
      | 'convert_project'
      | 'convert_task'
      | 'convert_habit'
      | 'someday'
      | 'reference'
      | 'decline',
    patch: Partial<Goal>,
    firstNextActionTitle?: string
  ) => {
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const targetGoal = prev.goals.find((g) => g.id === goalId);
      if (!targetGoal) return prev;
      const mergedGoal: Goal = {
        ...targetGoal,
        ...patch,
        updatedAt: nowIso,
      };

      if (decision === 'accept') {
        const acceptedGoal: Goal = {
          ...mergedGoal,
          status: 'active',
          reviewDate: mergedGoal.reviewDate || addDays(today, 7),
        };
        const nextTasks = [...prev.tasks];
        if (firstNextActionTitle && firstNextActionTitle.trim()) {
          nextTasks.unshift({
            id: makeId('task'),
            userId: prev.settings.userId,
            goalId: acceptedGoal.id,
            title: firstNextActionTitle.trim(),
            nextAction: firstNextActionTitle.trim(),
            status: 'todo',
            estMinutes: 25,
            scheduledDate: today,
            dueDate: null,
            rescheduleCount: 0,
            originInboxItemId: acceptedGoal.originInboxItemId || null,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
        return {
          ...prev,
          goals: prev.goals.map((g) => (g.id === goalId ? acceptedGoal : g)),
          tasks: nextTasks,
        };
      }

      if (decision === 'refine') {
        return {
          ...prev,
          goals: prev.goals.map((g) =>
            g.id === goalId ? { ...mergedGoal, status: 'candidate' } : g
          ),
        };
      }

      if (decision === 'convert_project') {
        const newProj: Project = {
          id: makeId('proj'),
          userId: prev.settings.userId,
          lifeAreaId: mergedGoal.lifeAreaId,
          title: mergedGoal.title,
          description: mergedGoal.desiredOutcome || mergedGoal.purposeReason,
          status: 'active',
          originInboxItemId: mergedGoal.originInboxItemId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        return {
          ...prev,
          projects: [newProj, ...prev.projects],
          goals: prev.goals.filter((g) => g.id !== goalId),
        };
      }

      if (decision === 'convert_task') {
        const newTask: Task = {
          id: makeId('task'),
          userId: prev.settings.userId,
          title: mergedGoal.title,
          nextAction:
            firstNextActionTitle ||
            mergedGoal.capacityNotes ||
            mergedGoal.desiredOutcome ||
            '',
          status: 'todo',
          estMinutes: 30,
          scheduledDate: today,
          rescheduleCount: 0,
          originInboxItemId: mergedGoal.originInboxItemId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        return {
          ...prev,
          tasks: [newTask, ...prev.tasks],
          goals: prev.goals.filter((g) => g.id !== goalId),
        };
      }

      if (decision === 'convert_habit') {
        const newRoutine: Routine = {
          id: makeId('rt'),
          userId: prev.settings.userId,
          title: mergedGoal.title.slice(0, 80),
          block: 'anytime',
          anchorType: 'clock',
          clockTime: '08:00',
          anchorOffsetMin: 0,
          appliesOn: 'all',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          isMust: false,
          active: true,
          sortOrder: prev.routines.length + 1,
          originInboxItemId: mergedGoal.originInboxItemId,
        };
        return {
          ...prev,
          routines: [...prev.routines, newRoutine],
          goals: prev.goals.filter((g) => g.id !== goalId),
        };
      }

      if (decision === 'someday' || decision === 'reference') {
        const newInb: InboxItem = {
          id: makeId('inb'),
          userId: prev.settings.userId,
          content: `${mergedGoal.title} — ${mergedGoal.desiredOutcome || ''}`,
          status: decision === 'someday' ? 'someday' : 'archived',
          itemType: decision === 'someday' ? 'goal_candidate' : 'reference',
          source: 'manual',
          decisionNote: mergedGoal.purposeReason || 'Moved from Goal Gate',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        return {
          ...prev,
          inboxItems: [newInb, ...prev.inboxItems],
          goals: prev.goals.filter((g) => g.id !== goalId),
        };
      }

      // decline
      return {
        ...prev,
        goals: prev.goals.map((g) =>
          g.id === goalId ? { ...mergedGoal, status: 'archived' } : g
        ),
      };
    });

    setActiveQualityGateGoalId(null);
    const toastMap: Record<typeof decision, string> = {
      accept: 'Goal Quality Gate pass! Ab ye Active Goal hai.',
      refine: 'Goal Candidate save ho gaya (kal phir review kar sakte hain).',
      convert_project: 'Goal Candidate ko Project me badal diya gaya.',
      convert_task: 'Goal Candidate ko Single Task me badal diya gaya.',
      convert_habit: 'Goal Candidate ko Daily Routine me badal diya gaya.',
      someday: 'Someday / Maybe list me surakshit rakh diya gaya.',
      reference: 'Reference / Idea archive me save kar diya gaya.',
      decline: 'Goal Candidate decline karke archive kar diya gaya.',
    };
    showToast(toastMap[decision], 'success');
  };

  const createProject = (fields: Partial<Project>): Project => {
    const nowIso = new Date().toISOString();
    const proj: Project = {
      id: makeId('proj'),
      userId: state.settings.userId,
      goalId: fields.goalId || null,
      lifeAreaId:
        fields.lifeAreaId || state.lifeAreas[0]?.id || 'area-personal',
      title: fields.title || 'Naya Project',
      description: fields.description || '',
      status: 'active',
      originInboxItemId: fields.originInboxItemId || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({ ...prev, projects: [proj, ...prev.projects] }));
    showToast('Project add ho gaya.', 'success');
    return proj;
  };

  const updateProject = (id: string, patch: Partial<Project>) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: nowIso } : p
      ),
    }));
  };

  const createMilestone = (fields: Partial<Milestone>): Milestone => {
    const nowIso = new Date().toISOString();
    const existingForGoal = state.milestones.filter(
      (m) => m.goalId === fields.goalId
    );
    const ms: Milestone = {
      id: makeId('ms'),
      userId: state.settings.userId,
      goalId: fields.goalId || '',
      title: fields.title || 'Milestone Checkpoint',
      description: fields.description || '',
      status: 'todo',
      seq: existingForGoal.length + 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({ ...prev, milestones: [...prev.milestones, ms] }));
    showToast('Milestone joda gaya.', 'success');
    return ms;
  };

  const updateMilestone = (id: string, patch: Partial<Milestone>) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: nowIso } : m
      ),
    }));
  };

  const reorderMilestone = (
    milestoneId: string,
    direction: 'up' | 'down'
  ) => {
    setState((prev) => {
      const target = prev.milestones.find((m) => m.id === milestoneId);
      if (!target) return prev;
      const siblings = prev.milestones
        .filter((m) => m.goalId === target.goalId)
        .sort((a, b) => a.seq - b.seq);
      const idx = siblings.findIndex((m) => m.id === milestoneId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;

      const reordered = [...siblings];
      const temp = reordered[idx];
      reordered[idx] = reordered[swapIdx];
      reordered[swapIdx] = temp;

      const seqMap = new Map<string, number>();
      reordered.forEach((m, i) => seqMap.set(m.id, i + 1));

      return {
        ...prev,
        milestones: prev.milestones.map((m) =>
          seqMap.has(m.id) ? { ...m, seq: seqMap.get(m.id)! } : m
        ),
      };
    });
  };

  const createLifeArea = (
    name: string,
    description?: string
  ): LifeArea | null => {
    if (!name.trim()) return null;
    const newArea: LifeArea = {
      id: makeId('area'),
      userId: state.settings.userId,
      name: name.trim(),
      description: description?.trim() || '',
      status: 'active',
      sortOrder: state.lifeAreas.length + 1,
    };
    setState((prev) => ({
      ...prev,
      lifeAreas: [...prev.lifeAreas, newArea],
    }));
    showToast(`Department / Field "${name.trim()}" add ho gaya.`, 'success');
    return newArea;
  };

  const updateLifeArea = (id: string, patch: Partial<LifeArea>) => {
    setState((prev) => ({
      ...prev,
      lifeAreas: prev.lifeAreas.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    }));
    showToast('Department update ho gaya.', 'success');
  };

  const archiveLifeArea = (id: string) => {
    setState((prev) => ({
      ...prev,
      lifeAreas: prev.lifeAreas.map((a) =>
        a.id === id ? { ...a, status: 'archived' as const } : a
      ),
    }));
  };

  return {
    createGoalCandidate,
    createDirectGoal,
    updateGoal,
    deleteGoal,
    resolveGoalCandidateGate,
    createProject,
    updateProject,
    createMilestone,
    updateMilestone,
    reorderMilestone,
    createLifeArea,
    updateLifeArea,
    archiveLifeArea,
  };
}
