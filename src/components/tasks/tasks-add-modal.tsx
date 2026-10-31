'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import { suggestIfThenPlan } from '@/src/lib/logic/planner';
import { Goal, Milestone, Project, TaskRecurrence } from '@/src/lib/types';

interface TasksAddModalProps {
  goals: Goal[];
  milestones: Milestone[];
  projects: Project[];
  today: string;
  onCancel: () => void;
  onCreate: (taskData: {
    title: string;
    nextAction: string;
    goalId?: string;
    milestoneId?: string;
    projectId?: string;
    scheduledDate?: string;
    dueDate?: string;
    estMinutes?: number;
    recurrence?: TaskRecurrence;
  }) => void;
}

export function TasksAddModal({
  goals,
  milestones,
  projects,
  today,
  onCancel,
  onCreate,
}: TasksAddModalProps) {
  const [title, setTitle] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [goalId, setGoalId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [estMinutes, setEstMinutes] = useState(25);
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      nextAction: nextAction.trim(),
      goalId: goalId || undefined,
      milestoneId: milestoneId || undefined,
      projectId: projectId || undefined,
      scheduledDate: scheduledDate || undefined,
      dueDate: dueDate || undefined,
      estMinutes: Number(estMinutes) || 25,
      recurrence,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Task Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kya kaam karna hai?"
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-base"
          />
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Concrete Next Action + &quot;Agar–To&quot; Obstacle Shield
            </label>
            <button
              type="button"
              onClick={() =>
                setNextAction(suggestIfThenPlan(title || 'is kaam', nextAction))
              }
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              + &quot;Agar–To&quot; Shield Jodo
            </button>
          </div>
          <input
            type="text"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Sabse pehla physical step..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-base"
          />
          <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-1">
            Hint: {STRINGS.today.taskQualityHint}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Link to Active Goal (Optional)
          </label>
          <select
            value={goalId}
            onChange={(e) => {
              setGoalId(e.target.value);
              setMilestoneId('');
            }}
            className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Standalone Task</option>
            {goals
              .filter((g) => g.status === 'active')
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Link to Milestone / Project (Optional)
          </label>
          <select
            value={milestoneId ? `ms:${milestoneId}` : projectId ? `proj:${projectId}` : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith('ms:')) {
                setMilestoneId(val.replace('ms:', ''));
                setProjectId('');
              } else if (val.startsWith('proj:')) {
                setProjectId(val.replace('proj:', ''));
                setMilestoneId('');
              } else {
                setMilestoneId('');
                setProjectId('');
              }
            }}
            className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {milestones
              .filter((m) => !goalId || m.goalId === goalId)
              .map((m) => (
                <option key={m.id} value={`ms:${m.id}`}>
                  Milestone: {m.title}
                </option>
              ))}
            {projects
              .filter((p) => p.status === 'active')
              .map((p) => (
                <option key={p.id} value={`proj:${p.id}`}>
                  Project: {p.title}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Scheduled Date
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Est (Min)
            </label>
            <input
              type="number"
              min={5}
              max={480}
              value={estMinutes}
              onChange={(e) => setEstMinutes(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Repeat / Recurrence (Complete hone par agli baar apne-aap banega)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { key: 'none', label: 'One-Time' },
                { key: 'daily', label: '↻ Daily' },
                { key: 'weekly', label: '↻ Weekly' },
                { key: 'monthly', label: '↻ Monthly' },
              ] as Array<{ key: TaskRecurrence; label: string }>
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRecurrence(opt.key)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  recurrence === opt.key
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-slate-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
        >
          Save Task
        </button>
      </div>
    </form>
  );
}
