'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { InboxItem } from '@/src/lib/types';

interface InboxTrashDrawerProps {
  trashedItems: InboxItem[];
  onRestoreItem: (id: string) => void;
  onBackToBrainDump: () => void;
}

export function InboxTrashDrawer({
  trashedItems,
  onRestoreItem,
  onBackToBrainDump,
}: InboxTrashDrawerProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
          Trash / Discarded Thoughts ({trashedItems.length})
        </h2>
        <button
          type="button"
          onClick={onBackToBrainDump}
          className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
        >
          ← Wapas Brain Dump par jayein
        </button>
      </div>
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-200/80 dark:divide-slate-800 overflow-hidden">
        {trashedItems.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 px-6 py-4.5 opacity-80"
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className="text-xs font-mono text-slate-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-400 line-through truncate">
                {item.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRestoreItem(item.id)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Wapas Lao</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
