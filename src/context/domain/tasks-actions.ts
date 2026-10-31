import React from 'react';
import { AppStateData, Task } from '@/src/lib/types';
import { computeNextRecurrenceDate } from '@/src/lib/logic/planner';
import { ToastMessage } from '@/src/context/types';
import { makeId } from './helpers';

export interface TasksActionsDeps {
  state: AppStateData;
  setState: React.Dispatch<React.SetStateAction<AppStateData>>;
  today: string;
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
}

export function buildTasksActions({
  state,
  setState,
  today,
  showToast,
}: TasksActionsDeps) {
  const createTask = (fields: Partial<Task>): Task => {
    const nowIso = new Date().toISOString();
    const newTask: Task = {
      id: makeId('task'),
      userId: state.settings.userId,
      goalId: fields.goalId || null,
      milestoneId: fields.milestoneId || null,
      projectId: fields.projectId || null,
      parentTaskId: fields.parentTaskId || null,
      originInboxItemId: fields.originInboxItemId || null,
      title: (fields.title || 'Naya Task').trim(),
      nextAction: fields.nextAction?.trim() || null,
      status: fields.status || 'todo',
      estMinutes: fields.estMinutes ?? 25,
      dueDate: fields.dueDate || null,
      scheduledDate: fields.scheduledDate || null,
      recurrence: fields.recurrence || 'none',
      rescheduleCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
    showToast('Task save ho gaya.', 'success');
    return newTask;
  };

  const updateTask = (id: string, patch: Partial<Task>) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: nowIso } : t
      ),
    }));
  };

  const completeTask = (id: string) => {
    const nowIso = new Date().toISOString();
    let extraToastNote = '';

    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === id);
      if (!target) return prev;

      let updatedTasks = prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'done' as const,
              completedAt: nowIso,
              updatedAt: nowIso,
            }
          : t
      );

      // 1. Recurring Task Auto-Spawn Next Occurrence
      if (target.recurrence && target.recurrence !== 'none') {
        const baseDate = target.scheduledDate || target.dueDate || today;
        const nextDate = computeNextRecurrenceDate(
          baseDate,
          target.recurrence
        );
        if (nextDate) {
          const spawnedTask: Task = {
            id: makeId('task'),
            userId: prev.settings.userId,
            goalId: target.goalId || null,
            milestoneId: target.milestoneId || null,
            projectId: target.projectId || null,
            parentTaskId: target.id,
            originInboxItemId: target.originInboxItemId || null,
            title: target.title,
            nextAction: target.nextAction || null,
            status: 'todo',
            estMinutes: target.estMinutes ?? 25,
            dueDate: target.dueDate ? nextDate : null,
            scheduledDate: nextDate,
            recurrence: target.recurrence,
            rescheduleCount: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          updatedTasks = [spawnedTask, ...updatedTasks];
          extraToastNote = ` · Agla ${target.recurrence} task (${nextDate}) set ho gaya`;
        }
      }

      // 2. Goal Next-Action Auto-Queue: if this task belonged to a Goal, ensure the next step is queued
      if (target.goalId) {
        const remainingGoalTodoTasks = updatedTasks.filter(
          (t) =>
            t.goalId === target.goalId &&
            t.id !== id &&
            (t.status === 'todo' || t.status === 'doing')
        );

        const hasTodayTaskForGoal = remainingGoalTodoTasks.some(
          (t) => t.scheduledDate === today
        );

        if (!hasTodayTaskForGoal && remainingGoalTodoTasks.length > 0) {
          const nextUp = remainingGoalTodoTasks[0];
          updatedTasks = updatedTasks.map((t) =>
            t.id === nextUp.id
              ? { ...t, scheduledDate: today, updatedAt: nowIso }
              : t
          );
          extraToastNote = ` · Goal ka agla step "${nextUp.title.slice(
            0,
            32
          )}" Aaj me queue ho gaya!`;
        }
      }

      return {
        ...prev,
        tasks: updatedTasks,
      };
    });

    showToast(
      `Shabash! Task poora ho gaya${extraToastNote}`,
      'success',
      () => {
        updateTask(id, { status: 'todo', completedAt: null });
      }
    );
  };

  const reopenTask = (id: string) => {
    updateTask(id, { status: 'todo', completedAt: null });
    showToast('Task reopen kar diya gaya.', 'info');
  };

  const rescheduleTask = (id: string, newDate: string) => {
    const nowIso = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              scheduledDate: newDate,
              dueDate: t.dueDate && t.dueDate < newDate ? newDate : t.dueDate,
              rescheduleCount: (t.rescheduleCount ?? 0) + 1,
              updatedAt: nowIso,
            }
          : t
      ),
    }));
    showToast(`Task ${newDate} ke liye reschedule ho gaya.`, 'info');
  };

  const splitTaskIntoSubtasks = (id: string, subTitles: string[]) => {
    const cleanTitles = subTitles.map((s) => s.trim()).filter(Boolean);
    if (cleanTitles.length === 0) return;
    const nowIso = new Date().toISOString();

    setState((prev) => {
      const parent = prev.tasks.find((t) => t.id === id);
      if (!parent) return prev;

      const children: Task[] = cleanTitles.map((title, idx) => ({
        id: makeId('task'),
        userId: prev.settings.userId,
        goalId: parent.goalId,
        milestoneId: parent.milestoneId,
        projectId: parent.projectId,
        parentTaskId: parent.id,
        originInboxItemId: parent.originInboxItemId,
        title,
        nextAction: title,
        status: 'todo',
        estMinutes: Math.max(
          10,
          Math.round((parent.estMinutes || 30) / cleanTitles.length)
        ),
        dueDate: parent.dueDate,
        scheduledDate: idx === 0 ? parent.scheduledDate || today : null,
        rescheduleCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      return {
        ...prev,
        tasks: [
          ...children,
          ...prev.tasks.map((t) =>
            t.id === id
              ? { ...t, status: 'cancelled' as const, updatedAt: nowIso }
              : t
          ),
        ],
      };
    });
    showToast(`Task ko ${cleanTitles.length} subtasks me baant diya gaya.`, 'info');
  };

  return {
    createTask,
    updateTask,
    completeTask,
    reopenTask,
    rescheduleTask,
    splitTaskIntoSubtasks,
  };
}
