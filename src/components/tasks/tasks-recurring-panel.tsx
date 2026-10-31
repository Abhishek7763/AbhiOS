'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import {
  DEFAULT_RECURRING_TEMPLATES,
  RecurringTaskTemplate,
} from '@/src/lib/logic/planner';

interface TasksRecurringPanelProps {
  onSpawnTemplate: (tpl: RecurringTaskTemplate) => void;
}

export function TasksRecurringPanel({
  onSpawnTemplate,
}: TasksRecurringPanelProps) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Bar-Bar Aane Wale Kaam (Recurring Task Templates)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mahine ke bills, bike maintenance, ya weekly reset ko 1 tap me Aaj ke plan me jodein.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEFAULT_RECURRING_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 flex flex-col justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {tpl.title}
                </h3>
                <span className="text-xs font-mono text-slate-500 whitespace-nowrap shrink-0">
                  {tpl.estMinutes} min
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                → {tpl.nextAction}
              </p>
              <p className="text-[11px] text-teal-700 dark:text-teal-400 font-mono">
                {tpl.cadenceLabel}
              </p>
            </div>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => onSpawnTemplate(tpl)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Aaj Jodo
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
