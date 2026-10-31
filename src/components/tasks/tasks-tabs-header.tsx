'use client';

import React from 'react';
import { Plus, Repeat } from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';

export type TaskFilterTab = 'today' | 'upcoming' | 'nodate' | 'done';

interface TasksTabsHeaderProps {
  currentTab: TaskFilterTab;
  onSelectTab: (tab: TaskFilterTab) => void;
  counts: {
    today: number;
    upcoming: number;
    nodate: number;
    done: number;
  };
  showAddForm: boolean;
  onToggleAddForm: () => void;
  showRecurringPanel: boolean;
  onToggleRecurringPanel: () => void;
}

export function TasksTabsHeader({
  currentTab,
  onSelectTab,
  counts,
  showAddForm,
  onToggleAddForm,
  showRecurringPanel,
  onToggleRecurringPanel,
}: TasksTabsHeaderProps) {
  const tabs: { key: TaskFilterTab; label: string; count: number }[] = [
    { key: 'today', label: 'Aaj', count: counts.today },
    { key: 'upcoming', label: 'Aane Wale', count: counts.upcoming },
    { key: 'nodate', label: 'Bina Date', count: counts.nodate },
    { key: 'done', label: 'Done', count: counts.done },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
        {tabs.map((t) => {
          const active = currentTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelectTab(t.key)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                active
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                  active
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleRecurringPanel}
          className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            showRecurringPanel
              ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Recurring Presets</span>
        </button>

        <button
          type="button"
          onClick={onToggleAddForm}
          className="min-h-[40px] px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Naya Task</span>
        </button>
      </div>
    </div>
  );
}
