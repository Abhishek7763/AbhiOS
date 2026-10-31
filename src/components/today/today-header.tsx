'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  ChevronDown,
  Eye,
  Sparkles,
} from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import { DUTY_SHIFT_PRESETS } from '@/src/lib/logic/planner';
import { DayPlan } from '@/src/lib/types';

interface TodayHeaderProps {
  today: string;
  todayPlan: DayPlan;
  onUpdateDayPlan: (patch: Partial<DayPlan>) => void;
  showShiftPresets: boolean;
  onToggleShiftPresets: () => void;
  onOpenDutyRoster: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  completedTasksCount: number;
  completedRoutinesCount: number;
  momentum: {
    encouragement: string;
    completedUnits: number;
    totalUnits: number;
    percent: number;
  };
  celebrationBanner: string | null;
}

export function TodayHeader({
  today,
  todayPlan,
  onUpdateDayPlan,
  showShiftPresets,
  onToggleShiftPresets,
  onOpenDutyRoster,
  zenMode,
  onToggleZenMode,
  completedTasksCount,
  completedRoutinesCount,
  momentum,
  celebrationBanner,
}: TodayHeaderProps) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Aaj · {today}</span>
            <span>·</span>
            <span>
              {todayPlan.isOff
                ? 'Off Day (Chhutti)'
                : `Duty ${todayPlan.dutyStart || '08:30'}`}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Aaj Ka Focus & Execution
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Off Day Toggle */}
          <button
            type="button"
            onClick={() => onUpdateDayPlan({ isOff: !todayPlan.isOff })}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
              todayPlan.isOff
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            {todayPlan.isOff ? 'Off Day: ON' : 'Duty Day'}
          </button>

          {/* Duty Start Time Input (if not Off Day) */}
          {!todayPlan.isOff && (
            <label className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200">
              <span>Duty:</span>
              <input
                type="time"
                aria-label="Duty Start Time"
                value={todayPlan.dutyStart || '08:30'}
                onChange={(e) =>
                  onUpdateDayPlan({ dutyStart: e.target.value })
                }
                className="bg-transparent font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </label>
          )}

          {/* Shift Presets Progressive Disclosure Toggle */}
          <button
            type="button"
            onClick={onToggleShiftPresets}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1"
          >
            <span>Shift Presets</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showShiftPresets ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Weekly Duty Roster Sheet Trigger */}
          <button
            type="button"
            onClick={onOpenDutyRoster}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-teal-600/30 bg-teal-50/70 dark:bg-teal-950/40 text-xs font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 flex items-center gap-1.5 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>{STRINGS.roster.openBtn}</span>
          </button>

          {/* Minimum Viable Day Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateDayPlan({ minimumDay: !todayPlan.minimumDay })
            }
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
              todayPlan.minimumDay
                ? 'bg-teal-700 text-white border-teal-700'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            {todayPlan.minimumDay ? 'Minimum Day: ON' : 'Minimum Day'}
          </button>

          {/* Zen Single-Focus Mode Toggle */}
          <button
            type="button"
            onClick={onToggleZenMode}
            data-testid="zen-mode-toggle"
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border flex items-center gap-1.5 ${
              zenMode
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{zenMode ? 'Zen Focus: ON' : 'Zen Focus'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible 1-Tap Duty Roster / Shift Presets */}
      {showShiftPresets && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
            1-Tap Shift Preset:
          </span>
          {DUTY_SHIFT_PRESETS.map((preset) => {
            const isSelected = preset.isOff
              ? todayPlan.isOff
              : !todayPlan.isOff && todayPlan.dutyStart === preset.dutyStart;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onUpdateDayPlan({
                    isOff: preset.isOff,
                    dutyStart:
                      preset.dutyStart ?? todayPlan.dutyStart ?? '08:30',
                  });
                  onToggleShiftPresets();
                }}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-teal-700/10 dark:bg-teal-500/20 border-teal-600/40 text-teal-800 dark:text-teal-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Aaj Ka Momentum Progress Bar */}
      <div
        data-testid="today-momentum-bar"
        className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Aaj Ka Momentum: {completedTasksCount} Tasks + {completedRoutinesCount}{' '}
            Routines Done · {momentum.encouragement}
          </span>
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
            {momentum.completedUnits} / {momentum.totalUnits} ({momentum.percent}%)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-600 to-emerald-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${momentum.percent}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>
      </div>

      {/* Satisfying Celebration Toast Banner on Task/Routine Tick */}
      <AnimatePresence>
        {celebrationBanner && (
          <motion.div
            data-testid="tick-celebration-banner"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className="mt-3 rounded-xl bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-600/20"
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
    </section>
  );
}
