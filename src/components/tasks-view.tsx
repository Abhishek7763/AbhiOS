'use client';

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { addDays } from '@/src/lib/logic/dates';
import {
  generateTwoMinuteStarter,
  RecurringTaskTemplate,
} from '@/src/lib/logic/planner';
import { Task, TaskRecurrence } from '@/src/lib/types';
import { playCompletionCelebrationSound } from '@/src/components/animated-check-button';

import {
  TasksTabsHeader,
  TaskFilterTab,
} from '@/src/components/tasks/tasks-tabs-header';
import { TasksRecurringPanel } from '@/src/components/tasks/tasks-recurring-panel';
import { TasksAddModal } from '@/src/components/tasks/tasks-add-modal';
import { TasksListItem } from '@/src/components/tasks/tasks-list-item';
import { TasksSplitModal } from '@/src/components/tasks/tasks-split-modal';

export function TasksView() {
  const {
    state,
    today,
    createTask,
    completeTask,
    reopenTask,
    rescheduleTask,
    updateTask,
    splitTaskIntoSubtasks,
    requestAiSuggestion,
  } = useGoalOs();

  const [tab, setTab] = useState<TaskFilterTab>('today');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(
    null
  );
  const [completingIds, setCompletingIds] = useState<Record<string, boolean>>(
    {}
  );
  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(
    null
  );
  const [expandedMenuTaskId, setExpandedMenuTaskId] = useState<string | null>(
    null
  );

  // Split state
  const [splittingTask, setSplittingTask] = useState<Task | null>(null);
  const [splitLines, setSplitLines] = useState('');
  const [aiSplitting, setAiSplitting] = useState(false);

  const handleToggleTaskDone = (task: Task) => {
    if (task.status === 'done') {
      reopenTask(task.id);
      return;
    }
    if (completingIds[task.id]) return;

    playCompletionCelebrationSound();
    setCelebratingTaskId(task.id);
    setCompletingIds((prev) => ({ ...prev, [task.id]: true }));
    setCelebrationBanner(`✓ "${task.title}" pura ho gaya! Shabaash!`);
    setExpandedMenuTaskId(null);

    window.setTimeout(() => {
      setCelebratingTaskId((prev) => (prev === task.id ? null : prev));
    }, 950);

    window.setTimeout(() => {
      setCelebrationBanner((prev) =>
        prev?.includes(task.title) ? null : prev
      );
    }, 2800);

    window.setTimeout(() => {
      completeTask(task.id);
      setCompletingIds((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }, 480);
  };

  const handleSpawnRecurringTemplate = (tpl: RecurringTaskTemplate) => {
    createTask({
      title: tpl.title,
      nextAction: tpl.nextAction,
      estMinutes: tpl.estMinutes,
      scheduledDate: today,
    });
    setShowRecurringPanel(false);
  };

  const handleAiSplit = async (task: Task) => {
    setAiSplitting(true);
    try {
      const res = await requestAiSuggestion('task_split', task.title, {
        nextAction: task.nextAction,
      });
      if (
        res.draft?.subItems &&
        res.draft.subItems.length > 0
      ) {
        setSplitLines(res.draft.subItems.join('\n'));
      }
    } finally {
      setAiSplitting(false);
    }
  };

  const counts = useMemo(() => {
    const active = state.tasks.filter((t) => t.status !== 'cancelled');
    return {
      today: active.filter(
        (t) =>
          (t.status === 'todo' || t.status === 'doing') &&
          (t.scheduledDate === today || (t.dueDate && t.dueDate <= today))
      ).length,
      upcoming: active.filter(
        (t) =>
          (t.status === 'todo' || t.status === 'doing') &&
          t.scheduledDate &&
          t.scheduledDate > today
      ).length,
      nodate: active.filter(
        (t) =>
          (t.status === 'todo' || t.status === 'doing') &&
          !t.scheduledDate &&
          !t.dueDate
      ).length,
      done: state.tasks.filter((t) => t.status === 'done').length,
    };
  }, [state.tasks, today]);

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((t) => {
      if (t.status === 'cancelled') return false;
      if (tab === 'done') return t.status === 'done';
      if (t.status === 'done') return false;

      if (tab === 'today') {
        return t.scheduledDate === today || (t.dueDate && t.dueDate <= today);
      }
      if (tab === 'upcoming') {
        return t.scheduledDate && t.scheduledDate > today;
      }
      if (tab === 'nodate') {
        return !t.scheduledDate && !t.dueDate;
      }
      return true;
    });
  }, [state.tasks, tab, today]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Tab bar & Actions */}
      <TasksTabsHeader
        currentTab={tab}
        onSelectTab={setTab}
        counts={counts}
        showAddForm={showAddForm}
        onToggleAddForm={() => setShowAddForm((v) => !v)}
        showRecurringPanel={showRecurringPanel}
        onToggleRecurringPanel={() => setShowRecurringPanel((v) => !v)}
      />

      {/* Recurring Task Templates Panel */}
      {showRecurringPanel && (
        <TasksRecurringPanel
          onSpawnTemplate={handleSpawnRecurringTemplate}
        />
      )}

      {/* Add Task Form Modal / Inline */}
      {showAddForm && (
        <TasksAddModal
          goals={state.goals}
          milestones={state.milestones}
          projects={state.projects}
          today={today}
          onCancel={() => setShowAddForm(false)}
          onCreate={(taskData: {
            title: string;
            nextAction: string;
            goalId?: string;
            milestoneId?: string;
            projectId?: string;
            scheduledDate?: string;
            dueDate?: string;
            estMinutes?: number;
            recurrence?: TaskRecurrence;
          }) => {
            createTask(taskData);
            setShowAddForm(false);
          }}
        />
      )}

      {/* Celebration Toast Banner */}
      <AnimatePresence>
        {celebrationBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
            className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-600/25"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              {celebrationBanner}
            </span>
            <span className="font-mono text-[11px] bg-white/20 px-2 py-0.5 rounded-md">
              ✓ Done
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks List */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Is section me koi task nahi hai.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const linkedGoal = state.goals.find((g) => g.id === task.goalId);
            const linkedProj = state.projects.find(
              (p) => p.id === task.projectId
            );
            const isCompleting = Boolean(completingIds[task.id]);
            const isDone = task.status === 'done' || isCompleting;
            const isCelebrating =
              celebratingTaskId === task.id || isCompleting;
            const isMenuOpen = expandedMenuTaskId === task.id;

            return (
              <TasksListItem
                key={task.id}
                task={task}
                today={today}
                linkedGoal={linkedGoal}
                linkedProject={linkedProj}
                isDone={isDone}
                isCelebrating={isCelebrating}
                isCompleting={isCompleting}
                isMenuOpen={isMenuOpen}
                onToggleDone={() => handleToggleTaskDone(task)}
                onReopen={() => reopenTask(task.id)}
                onReschedule={(targetDate) =>
                  rescheduleTask(
                    task.id,
                    targetDate === 'tomorrow' ? addDays(today, 1) : targetDate
                  )
                }
                onToggleMenu={() =>
                  setExpandedMenuTaskId(isMenuOpen ? null : task.id)
                }
                onSplitTask={() => {
                  setExpandedMenuTaskId(null);
                  setSplittingTask(task);
                  setSplitLines(
                    `${task.title} - Step 1\n${task.title} - Step 2`
                  );
                }}
                onTwoMinuteStarter={() => {
                  splitTaskIntoSubtasks(
                    task.id,
                    generateTwoMinuteStarter(task.title, task.nextAction)
                  );
                  setExpandedMenuTaskId(null);
                }}
                onPause={() => {
                  updateTask(task.id, { status: 'paused' });
                  setExpandedMenuTaskId(null);
                }}
                onCancel={() => {
                  updateTask(task.id, { status: 'cancelled' });
                  setExpandedMenuTaskId(null);
                }}
              />
            );
          })
        )}
      </section>

      {/* Split Modal with Optional AI Assist */}
      {splittingTask && (
        <TasksSplitModal
          task={splittingTask}
          splitLines={splitLines}
          onChangeSplitLines={setSplitLines}
          aiSplitting={aiSplitting}
          onAiSplit={() => handleAiSplit(splittingTask)}
          onClose={() => setSplittingTask(null)}
          onSubmit={() => {
            splitTaskIntoSubtasks(
              splittingTask.id,
              splitLines.split('\n')
            );
            setSplittingTask(null);
          }}
        />
      )}
    </div>
  );
}
