'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Clock,
  Inbox,
  Search,
  Target,
  X,
  ArrowRight,
} from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { searchAllEntities } from '@/src/lib/logic/planner';

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const { state, setActiveTab } = useGoalOs();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setQuery('');
      });
    }
  }, [open]);

  const results = useMemo(
    () => searchAllEntities(query, state),
    [query, state]
  );

  if (!open) return null;

  const getIcon = (kind: 'inbox' | 'goal' | 'task' | 'routine') => {
    switch (kind) {
      case 'inbox':
        return <Inbox className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'goal':
        return <Target className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
      case 'task':
        return (
          <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        );
      case 'routine':
        return <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 backdrop-blur-xs p-4 pt-14 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Global Quick Search"
    >
      <div
        data-testid="global-search-modal"
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <input
            type="text"
            data-testid="global-search-input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Brain Dump, Goals, Tasks ya Routines me khojein..."
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results Body */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {!query.trim() ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Quick Search (Ctrl + K)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Koi bhi keyword likhein (jaise <span className="font-mono">fund</span>,{' '}
                <span className="font-mono">walk</span>,{' '}
                <span className="font-mono">bill</span>,{' '}
                <span className="font-mono">health</span>) — Brain Dump, Goals, Tasks aur Routines sab ek saath dikhenge.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              &ldquo;{query}&rdquo; se milta-julta kuch nahi mila.
            </div>
          ) : (
            results.map((hit) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                data-testid={`search-result-${hit.kind}-${hit.id}`}
                onClick={() => {
                  setActiveTab(hit.targetTab);
                  onClose();
                }}
                className="w-full px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">{getIcon(hit.kind)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {hit.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {hit.subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {hit.badge}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
