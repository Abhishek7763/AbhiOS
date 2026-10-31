'use client';

import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import { Task, InboxItem } from '@/src/lib/types';

interface NeedsAttentionData {
  overdueTasks: Task[];
  staleTasks: Task[];
  rescheduleHeavyTasks: Task[];
  oldInboxItems: InboxItem[];
  totalCount: number;
}

interface TodayNeedsAttentionProps {
  attention: NeedsAttentionData;
  showAttentionSheet: boolean;
  onToggleSheet: () => void;
  onReschedule: (taskId: string, targetDate: string) => void;
  onOpenSplit: (task: Task) => void;
  onCancelTask: (taskId: string) => void;
  onOpenInboxTab: () => void;
  today: string;
}

export function TodayNeedsAttention({
  attention,
  showAttentionSheet,
  onToggleSheet,
  onReschedule,
  onOpenSplit,
  onCancelTask,
  onOpenInboxTab,
  today,
}: TodayNeedsAttentionProps) {
  if (attention.totalCount === 0 && attention.oldInboxItems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {STRINGS.today.needsAttention}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              {attention.overdueTasks.length > 0 && (
                <span>{attention.overdueTasks.length} overdue</span>
              )}
              {attention.staleTasks.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {attention.staleTasks.length} stale (14+ din, review karein)
                  </span>
                </>
              )}
              {attention.rescheduleHeavyTasks.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {attention.rescheduleHeavyTasks.length} task 3+ baar टला
                  </span>
                </>
              )}
              {attention.oldInboxItems.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {attention.oldInboxItems.length} inbox thoughts 2+ din purane
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSheet}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          {showAttentionSheet ? 'Chhupao' : 'Dekho & Suljhao'}
        </button>
      </div>

      {showAttentionSheet && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {[...attention.overdueTasks, ...attention.staleTasks].map((t) => (
            <div
              key={t.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t.title}
                </p>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  Due: {t.dueDate} · Rescheduled: {t.rescheduleCount}x
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onReschedule(t.id, today)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-medium"
                >
                  Aaj Karo
                </button>
                <button
                  type="button"
                  onClick={() => onReschedule(t.id, 'tomorrow')}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Kal Karo
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSplit(t)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-medium"
                >
                  Chhota Karo (Split)
                </button>
                <button
                  type="button"
                  onClick={() => onCancelTask(t.id)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}

          {attention.oldInboxItems.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {STRINGS.inbox.oldItemsInfo(attention.oldInboxItems.length)}
              </span>
              <button
                type="button"
                onClick={onOpenInboxTab}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1"
              >
                Brain Dump Triage Kholo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
