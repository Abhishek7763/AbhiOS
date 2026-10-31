'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Task } from '@/src/lib/types';

interface TasksSplitModalProps {
  task: Task;
  splitLines: string;
  onChangeSplitLines: (lines: string) => void;
  aiSplitting: boolean;
  onAiSplit: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function TasksSplitModal({
  task,
  splitLines,
  onChangeSplitLines,
  aiSplitting,
  onAiSplit,
  onClose,
  onSubmit,
}: TasksSplitModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Split Task: {task.title}
          </h3>
          <button
            type="button"
            onClick={onAiSplit}
            disabled={aiSplitting}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-semibold flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiSplitting ? 'Splitting...' : 'AI Se Steps Banwao'}
          </button>
        </div>
        <textarea
          rows={4}
          value={splitLines}
          onChange={(e) => onChangeSplitLines(e.target.value)}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-base"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
          >
            Create Subtasks
          </button>
        </div>
      </div>
    </div>
  );
}
