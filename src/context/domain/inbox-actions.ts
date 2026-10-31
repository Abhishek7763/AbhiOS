import React from 'react';
import {
  AppStateData,
  Goal,
  InboxItem,
  InboxLink,
  Milestone,
  Project,
  Routine,
  Task,
} from '@/src/lib/types';
import { addDays } from '@/src/lib/logic/dates';
import { ToastMessage } from '@/src/context/types';
import { makeId } from './helpers';

export interface InboxActionsDeps {
  state: AppStateData;
  setState: React.Dispatch<React.SetStateAction<AppStateData>>;
  today: string;
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
  setActiveQualityGateGoalId: (id: string | null) => void;
}

export function buildInboxActions({
  state,
  setState,
  today,
  showToast,
  setActiveQualityGateGoalId,
}: InboxActionsDeps) {
  const quickCapture = (
    content: string,
    source: InboxItem['source'] = 'quick_capture',
    options?: {
      lifeAreaId?: string | null;
      tags?: string[];
      status?: InboxItem['status'];
      decisionNote?: string;
    }
  ): InboxItem | null => {
    const trimmed = content.trim();
    if (!trimmed) return null;
    const nowIso = new Date().toISOString();
    const targetStatus = options?.status || 'new';
    const newItem: InboxItem = {
      id: makeId('inb'),
      userId: state.settings.userId,
      content: trimmed,
      status: targetStatus,
      itemType: targetStatus === 'trash' ? 'duplicate' : 'unknown',
      source,
      lifeAreaId: options?.lifeAreaId || null,
      tags: options?.tags && options.tags.length > 0 ? options.tags : [],
      decisionNote: options?.decisionNote,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({
      ...prev,
      inboxItems: [newItem, ...prev.inboxItems],
    }));
    if (targetStatus === 'trash') {
      showToast(
        'Thought seedha Trash me bhej diya gaya (Trash se wapas nikal sakte hain).',
        'info'
      );
    } else {
      showToast(
        'Brain Dump me save ho gaya — ab bagal se Category ya Goal me bhej sakte hain.',
        'success'
      );
    }
    return newItem;
  };

  const updateInboxItem = (id: string, patch: Partial<InboxItem>) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      inboxItems: prev.inboxItems.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: nowIso } : item
      ),
    }));
  };

  const restoreInboxItem = (id: string) => {
    updateInboxItem(id, { status: 'new', archivedAt: null });
    showToast('Thought wapas Unprocessed queue me aa gaya.', 'info');
  };

  const splitInboxItem = (id: string, subContents: string[]) => {
    const validLines = subContents.map((s) => s.trim()).filter(Boolean);
    if (validLines.length === 0) return;
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const parent = prev.inboxItems.find((i) => i.id === id);
      if (!parent) return prev;

      const childItems: InboxItem[] = validLines.map((line) => ({
        id: makeId('inb'),
        userId: prev.settings.userId,
        content: line,
        status: 'new',
        itemType: 'unknown',
        source: 'split',
        decisionNote: `Split from: "${parent.content.slice(0, 45)}"`,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      const links: InboxLink[] = childItems.map((child) => ({
        id: makeId('lnk'),
        userId: prev.settings.userId,
        inboxItemId: id,
        targetType: 'inbox_item',
        targetId: child.id,
        createdAt: nowIso,
      }));

      return {
        ...prev,
        inboxItems: [
          ...childItems,
          ...prev.inboxItems.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'processed' as const,
                  linkedEntityType: 'split_multiple' as const,
                  processedAt: nowIso,
                  updatedAt: nowIso,
                }
              : item
          ),
        ],
        inboxLinks: [...prev.inboxLinks, ...links],
      };
    });
    showToast(
      `Thought ko ${validLines.length} alag items me split kar diya gaya.`,
      'success'
    );
  };

  const mergeInboxItems = (primaryId: string, duplicateId: string) => {
    if (primaryId === duplicateId) return;
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const primary = prev.inboxItems.find((i) => i.id === primaryId);
      const dup = prev.inboxItems.find((i) => i.id === duplicateId);
      if (!primary || !dup) return prev;

      const mergedContent = `${primary.content}\n---\n[Merged]: ${dup.content}`;
      return {
        ...prev,
        inboxItems: prev.inboxItems.map((item) => {
          if (item.id === primaryId) {
            return { ...item, content: mergedContent, updatedAt: nowIso };
          }
          if (item.id === duplicateId) {
            return {
              ...item,
              status: 'trash' as const,
              itemType: 'duplicate' as const,
              decisionNote: `Merged into ${primaryId}`,
              updatedAt: nowIso,
            };
          }
          return item;
        }),
      };
    });
    showToast('Dono thoughts merge ho gaye (duplicate Trash me gaya).', 'info');
  };

  const convertInboxToEntity = (
    inboxId: string,
    targetType: 'task' | 'goal_candidate' | 'project' | 'routine',
    fields: Record<string, unknown>
  ): string => {
    const nowIso = new Date().toISOString();
    const newEntityId = makeId(
      targetType === 'goal_candidate' ? 'goal' : targetType.slice(0, 4)
    );

    setState((prev) => {
      const origin = prev.inboxItems.find((i) => i.id === inboxId);
      const rawText = origin?.content || '';
      const defaultAreaId = prev.lifeAreas[0]?.id || 'area-personal';

      let nextTasks = prev.tasks;
      let nextGoals = prev.goals;
      let nextProjects = prev.projects;
      let nextRoutines = prev.routines;
      let linkedEntityType: InboxItem['linkedEntityType'] = 'task';

      if (targetType === 'task') {
        linkedEntityType = 'task';
        const newTask: Task = {
          id: newEntityId,
          userId: prev.settings.userId,
          title: String(fields.title || rawText.slice(0, 140)),
          nextAction: String(fields.nextAction || ''),
          goalId: fields.goalId ? String(fields.goalId) : null,
          milestoneId: fields.milestoneId ? String(fields.milestoneId) : null,
          projectId: fields.projectId ? String(fields.projectId) : null,
          originInboxItemId: inboxId,
          status: 'todo',
          estMinutes: fields.estMinutes ? Number(fields.estMinutes) : 20,
          dueDate: fields.dueDate ? String(fields.dueDate) : null,
          scheduledDate: fields.scheduledDate
            ? String(fields.scheduledDate)
            : null,
          rescheduleCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextTasks = [newTask, ...prev.tasks];
      } else if (targetType === 'goal_candidate') {
        linkedEntityType = 'goal';
        const isDirectActive = Boolean(fields.directActivate);
        const resolvedTags =
          Array.isArray(fields.tags) && fields.tags.length > 0
            ? (fields.tags as string[])
            : origin?.tags || [];
        const newCandidate: Goal = {
          id: newEntityId,
          userId: prev.settings.userId,
          lifeAreaId: String(
            fields.lifeAreaId || origin?.lifeAreaId || defaultAreaId
          ),
          title: String(fields.title || rawText.slice(0, 140)),
          desiredOutcome: String(fields.desiredOutcome || rawText),
          purposeReason: String(fields.purposeReason || ''),
          ownershipReflection: String(fields.ownershipReflection || ''),
          evidenceOfProgress: String(fields.evidenceOfProgress || ''),
          controlNotes: String(fields.controlNotes || ''),
          tradeoffs: String(fields.tradeoffs || ''),
          capacityNotes: String(fields.capacityNotes || ''),
          tags: resolvedTags,
          goalType:
            (fields.goalType as 'outcome' | 'ongoing_direction') || 'outcome',
          status: isDirectActive ? 'active' : 'candidate',
          targetDate: fields.targetDate ? String(fields.targetDate) : null,
          reviewDate: addDays(today, 7),
          reviewCadence:
            (fields.reviewCadence as 'weekly' | 'biweekly' | 'monthly') ||
            'weekly',
          originInboxItemId: inboxId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextGoals = [newCandidate, ...prev.goals];
      } else if (targetType === 'project') {
        linkedEntityType = 'project';
        const newProj: Project = {
          id: newEntityId,
          userId: prev.settings.userId,
          goalId: fields.goalId ? String(fields.goalId) : null,
          lifeAreaId: String(
            fields.lifeAreaId || origin?.lifeAreaId || defaultAreaId
          ),
          title: String(fields.title || rawText.slice(0, 140)),
          description: String(fields.description || rawText),
          status: 'active',
          originInboxItemId: inboxId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextProjects = [newProj, ...prev.projects];
      } else if (targetType === 'routine') {
        linkedEntityType = 'routine';
        const newRoutine: Routine = {
          id: newEntityId,
          userId: prev.settings.userId,
          originInboxItemId: inboxId,
          title: String(fields.title || rawText.slice(0, 80)),
          block: (fields.block as Routine['block']) || 'anytime',
          anchorType:
            (fields.anchorType as Routine['anchorType']) || 'clock',
          clockTime: String(fields.clockTime || '08:00'),
          anchorOffsetMin: Number(fields.anchorOffsetMin || 0),
          appliesOn: (fields.appliesOn as Routine['appliesOn']) || 'all',
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          isMust: Boolean(fields.isMust),
          active: true,
          sortOrder: prev.routines.length + 1,
        };
        nextRoutines = [...prev.routines, newRoutine];
      }

      const newLink: InboxLink = {
        id: makeId('lnk'),
        userId: prev.settings.userId,
        inboxItemId: inboxId,
        targetType: linkedEntityType,
        targetId: newEntityId,
        createdAt: nowIso,
      };

      return {
        ...prev,
        tasks: nextTasks,
        goals: nextGoals,
        projects: nextProjects,
        routines: nextRoutines,
        inboxLinks: [...prev.inboxLinks, newLink],
        inboxItems: prev.inboxItems.map((i) =>
          i.id === inboxId
            ? {
                ...i,
                status: 'processed' as const,
                itemType:
                  targetType === 'routine'
                    ? ('habit_candidate' as const)
                    : targetType,
                lifeAreaId:
                  fields.lifeAreaId
                    ? String(fields.lifeAreaId)
                    : i.lifeAreaId || null,
                tags:
                  Array.isArray(fields.tags) && fields.tags.length > 0
                    ? (fields.tags as string[])
                    : i.tags || [],
                linkedEntityType,
                linkedEntityId: newEntityId,
                processedAt: nowIso,
                updatedAt: nowIso,
              }
            : i
        ),
      };
    });

    if (targetType === 'goal_candidate') {
      if (fields.directActivate) {
        showToast(
          'Brain Dump se Active Goal seedha Department me add ho gaya!',
          'success'
        );
      } else {
        setActiveQualityGateGoalId(newEntityId);
        showToast(
          'Goal Candidate ban gaya — ab Quality Gate review karein.',
          'info'
        );
      }
    } else {
      showToast(`Inbox item ko ${targetType} me badal diya gaya!`, 'success');
    }

    return newEntityId;
  };

  const moveInboxToExistingGoal = (
    inboxId: string,
    goalId: string,
    stepType: 'milestone' | 'task' = 'milestone',
    customTitle?: string
  ): string => {
    const nowIso = new Date().toISOString();
    const stepId = makeId(stepType === 'milestone' ? 'ms' : 'task');

    setState((prev) => {
      const origin = prev.inboxItems.find((i) => i.id === inboxId);
      const targetGoal = prev.goals.find((g) => g.id === goalId);
      const cleanTitle = (
        customTitle ||
        origin?.content.split('\n')[0] ||
        'Goal Action Step'
      ).trim();

      let nextMilestones = prev.milestones;
      let nextTasks = prev.tasks;

      if (stepType === 'milestone') {
        const existingGoalMs = prev.milestones.filter(
          (m) => m.goalId === goalId
        );
        const newMs: Milestone = {
          id: stepId,
          userId: prev.settings.userId,
          goalId,
          title: cleanTitle,
          description: origin?.content || cleanTitle,
          status: 'todo',
          seq: existingGoalMs.length + 1,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextMilestones = [...prev.milestones, newMs];
      } else {
        const newTask: Task = {
          id: stepId,
          userId: prev.settings.userId,
          title: cleanTitle,
          nextAction: origin?.content || cleanTitle,
          goalId,
          milestoneId: null,
          projectId: null,
          originInboxItemId: inboxId,
          status: 'todo',
          estMinutes: 25,
          dueDate: null,
          scheduledDate: today,
          rescheduleCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextTasks = [newTask, ...prev.tasks];
      }

      const newLink: InboxLink = {
        id: makeId('lnk'),
        userId: prev.settings.userId,
        inboxItemId: inboxId,
        targetType: 'goal',
        targetId: goalId,
        createdAt: nowIso,
      };

      return {
        ...prev,
        milestones: nextMilestones,
        tasks: nextTasks,
        inboxLinks: [...prev.inboxLinks, newLink],
        inboxItems: prev.inboxItems.map((i) =>
          i.id === inboxId
            ? {
                ...i,
                status: 'processed' as const,
                itemType:
                  stepType === 'milestone'
                    ? ('goal_candidate' as const)
                    : ('task' as const),
                lifeAreaId: targetGoal?.lifeAreaId || i.lifeAreaId || null,
                linkedEntityType: 'goal' as const,
                linkedEntityId: goalId,
                decisionNote: `Moved directly to Goal: ${
                  targetGoal?.title || goalId
                }`,
                processedAt: nowIso,
                updatedAt: nowIso,
              }
            : i
        ),
      };
    });

    showToast(
      stepType === 'milestone'
        ? 'Thought seedha chune gaye Goal ke Plan (Step) me jud gaya!'
        : 'Thought seedha chune gaye Goal ke Daily Task me jud gaya!',
      'success'
    );

    return stepId;
  };

  const captureAndMoveToGoal = (
    content: string,
    goalId: string,
    stepType: 'milestone' | 'task' = 'milestone'
  ): string | null => {
    const trimmed = content.trim();
    if (!trimmed) return null;
    const nowIso = new Date().toISOString();
    const inboxId = makeId('inb');
    const stepId = makeId(stepType === 'milestone' ? 'ms' : 'task');

    setState((prev) => {
      const targetGoal = prev.goals.find((g) => g.id === goalId);
      const cleanTitle = trimmed.split('\n')[0].trim();

      const newInboxItem: InboxItem = {
        id: inboxId,
        userId: prev.settings.userId,
        content: trimmed,
        status: 'processed',
        itemType: stepType === 'milestone' ? 'goal_candidate' : 'task',
        source: 'manual',
        lifeAreaId: targetGoal?.lifeAreaId || null,
        linkedEntityType: 'goal',
        linkedEntityId: goalId,
        decisionNote: `Moved directly to Goal: ${
          targetGoal?.title || goalId
        }`,
        processedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      let nextMilestones = prev.milestones;
      let nextTasks = prev.tasks;

      if (stepType === 'milestone') {
        const existingGoalMs = prev.milestones.filter(
          (m) => m.goalId === goalId
        );
        const newMs: Milestone = {
          id: stepId,
          userId: prev.settings.userId,
          goalId,
          title: cleanTitle,
          description: trimmed,
          status: 'todo',
          seq: existingGoalMs.length + 1,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextMilestones = [...prev.milestones, newMs];
      } else {
        const newTask: Task = {
          id: stepId,
          userId: prev.settings.userId,
          title: cleanTitle,
          nextAction: trimmed,
          goalId,
          milestoneId: null,
          projectId: null,
          originInboxItemId: inboxId,
          status: 'todo',
          estMinutes: 25,
          dueDate: null,
          scheduledDate: today,
          rescheduleCount: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextTasks = [newTask, ...prev.tasks];
      }

      const newLink: InboxLink = {
        id: makeId('lnk'),
        userId: prev.settings.userId,
        inboxItemId: inboxId,
        targetType: 'goal',
        targetId: goalId,
        createdAt: nowIso,
      };

      return {
        ...prev,
        inboxItems: [newInboxItem, ...prev.inboxItems],
        milestones: nextMilestones,
        tasks: nextTasks,
        inboxLinks: [...prev.inboxLinks, newLink],
      };
    });

    showToast(
      stepType === 'milestone'
        ? 'Thought capture karke Goal ke Plan (Step) me jod diya!'
        : 'Thought capture karke Goal ke Daily Task me jod diya!',
      'success'
    );

    return stepId;
  };

  return {
    quickCapture,
    updateInboxItem,
    restoreInboxItem,
    splitInboxItem,
    mergeInboxItems,
    convertInboxToEntity,
    moveInboxToExistingGoal,
    captureAndMoveToGoal,
  };
}
