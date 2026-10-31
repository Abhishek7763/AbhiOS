'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Infinity as InfinityIcon,
  Layers,
  Pause,
  Scale,
  Target,
} from 'lucide-react';
import { LifeArea } from '@/src/lib/types';

export type TopGoalViewMode = 'categories' | 'ongoing' | 'candidates' | 'someday';

interface LifeBalanceData {
  items: Array<{
    areaId: string;
    name: string;
    activeGoalsCount: number;
    completedTasksCount: number;
    statusLabel: string;
  }>;
  calmInsight: string;
}

interface GoalsHeaderTabsProps {
  viewMode: TopGoalViewMode;
  onSelectViewMode: (mode: TopGoalViewMode) => void;
  showBalanceSnapshot: boolean;
  onToggleBalanceSnapshot: () => void;
  lifeBalance: LifeBalanceData;
  activeLifeAreas: LifeArea[];
  ongoingGoalsCount: number;
  candidateGoalsCount: number;
  somedayGoalsCount: number;
  onSelectAreaFromBalance: (areaId: string) => void;
}

export function GoalsHeaderTabs({
  viewMode,
  onSelectViewMode,
  showBalanceSnapshot,
  onToggleBalanceSnapshot,
  lifeBalance,
  activeLifeAreas,
  ongoingGoalsCount,
  candidateGoalsCount,
  somedayGoalsCount,
  onSelectAreaFromBalance,
}: GoalsHeaderTabsProps) {
  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Goals
          </h1>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Category chunein → Goal kholein → Edit, Plan aur Aage ka Process
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleBalanceSnapshot}
          data-testid="toggle-department-balance"
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 shrink-0 ${
            showBalanceSnapshot
              ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600/50 text-teal-800 dark:text-teal-300'
              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-teal-600" />
          <span>Department Balance</span>
          {showBalanceSnapshot ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Collapsible Calm Department Balance Snapshot */}
      {showBalanceSnapshot && (
        <div
          data-testid="department-balance-snapshot"
          className="rounded-2xl bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Calm Life Balance Overview (Zero Guilt)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {
                lifeBalance.items.filter(
                  (i) => i.activeGoalsCount > 0 || i.completedTasksCount > 0
                ).length
              }
              /{lifeBalance.items.length} Active Fields
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lifeBalance.items.map((row) => (
              <button
                key={row.areaId}
                type="button"
                onClick={() => onSelectAreaFromBalance(row.areaId)}
                className="text-left rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2 hover:border-teal-500 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {row.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {row.activeGoalsCount} Goals · {row.completedTasksCount} Done · {row.statusLabel}
                  </p>
                </div>
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    row.activeGoalsCount > 0 || row.completedTasksCount > 0
                      ? 'bg-emerald-500'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            💡 {lifeBalance.calmInsight}
          </p>
        </div>
      )}

      {/* Top Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => onSelectViewMode('categories')}
          className={`min-h-[50px] px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
            viewMode === 'categories'
              ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold leading-tight truncate">
                Goals
              </p>
              <p
                className={`text-[11px] truncate ${
                  viewMode === 'categories' ? 'text-teal-100' : 'text-slate-500'
                }`}
              >
                Categories ({activeLifeAreas.length})
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('ongoing')}
          className={`min-h-[50px] px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
            viewMode === 'ongoing'
              ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <InfinityIcon className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold leading-tight truncate">
                Ongoing Goals
              </p>
              <p
                className={`text-[11px] truncate ${
                  viewMode === 'ongoing' ? 'text-teal-100' : 'text-slate-500'
                }`}
              >
                Ongoing ({ongoingGoalsCount})
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('candidates')}
          className={`min-h-[50px] px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
            viewMode === 'candidates'
              ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold leading-tight truncate">
                Candidates
              </p>
              <p
                className={`text-[11px] truncate ${
                  viewMode === 'candidates' ? 'text-teal-100' : 'text-slate-500'
                }`}
              >
                Quality Gate ({candidateGoalsCount})
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectViewMode('someday')}
          className={`min-h-[50px] px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
            viewMode === 'someday'
              ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Pause className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold leading-tight truncate">
                Someday / Maybe
              </p>
              <p
                className={`text-[11px] truncate ${
                  viewMode === 'someday' ? 'text-teal-100' : 'text-slate-500'
                }`}
              >
                Paused ({somedayGoalsCount})
              </p>
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
