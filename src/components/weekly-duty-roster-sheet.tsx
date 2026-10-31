'use client';

import React, { useState } from 'react';
import { Calendar, X, Check, Clock } from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { STRINGS } from '@/src/lib/strings';
import { addDays, formatIsoToDisplayDate, isoDow } from '@/src/lib/logic/dates';
import {
  buildWeeklyDutyRoster,
  DUTY_SHIFT_PRESETS,
  WeeklyRosterInputEntry,
} from '@/src/lib/logic/planner';

const HINDI_DAY_NAMES: Record<number, string> = {
  1: 'Somvar',
  2: 'Mangalvar',
  3: 'Budhvar',
  4: 'Guruvar',
  5: 'Shukravar',
  6: 'Shanivar',
  7: 'Ravivar',
};

interface WeeklyDutyRosterSheetProps {
  open: boolean;
  onClose: () => void;
}

export function WeeklyDutyRosterSheet({
  open,
  onClose,
}: WeeklyDutyRosterSheetProps) {
  const { state, today, bulkUpsertDayPlans } = useGoalOs();

  // Initialize 7 days state from existing dayPlans or defaults
  const [entries, setEntries] = useState<WeeklyRosterInputEntry[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const curDate = addDays(today, i);
      const existing = state.dayPlans.find((dp) => dp.planDate === curDate);
      return {
        date: curDate,
        isOff: existing?.isOff ?? false,
        dutyStart: existing?.dutyStart || '08:30',
      };
    });
  });

  if (!open) return null;

  const updateEntry = (
    index: number,
    patch: Partial<WeeklyRosterInputEntry>
  ) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleSave = () => {
    const plans = buildWeeklyDutyRoster(
      today,
      entries,
      state.dayPlans,
      state.settings.userId
    );
    bulkUpsertDayPlans(plans);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duty-roster-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h2
                id="duty-roster-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                {STRINGS.roster.sheetTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {STRINGS.roster.sheetSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Duty Roster"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7 Days List */}
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const dow = isoDow(entry.date);
            const dayName = HINDI_DAY_NAMES[dow] || '';
            const isToday = entry.date === today;
            const isTomorrow = entry.date === addDays(today, 1);
            const dayLabel = isToday ? 'Aaj' : isTomorrow ? 'Kal' : dayName;

            return (
              <div
                key={entry.date}
                className={`rounded-2xl border p-3.5 space-y-2.5 transition-colors ${
                  entry.isOff
                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                    : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Date Header + Off Toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {dayLabel} · {formatIsoToDisplayDate(entry.date)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      ({dayName})
                    </span>
                  </div>

                  {/* Off Day Toggle */}
                  <button
                    type="button"
                    onClick={() => updateEntry(idx, { isOff: !entry.isOff })}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors ${
                      entry.isOff
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {entry.isOff ? 'Chhutti (Off)' : 'Duty Hai'}
                  </button>
                </div>

                {/* Duty Timing Selector (If Duty Day) */}
                {!entry.isOff && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DUTY_SHIFT_PRESETS.filter((p) => !p.isOff).map(
                        (preset) => {
                          const isSelected =
                            entry.dutyStart === preset.dutyStart;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                updateEntry(idx, {
                                  dutyStart: preset.dutyStart,
                                })
                              }
                              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                isSelected
                                  ? 'bg-teal-700 text-white border-teal-700 font-semibold shadow-xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-500'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        }
                      )}

                      {/* Custom Time */}
                      <label className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <input
                          type="time"
                          aria-label={`Duty time for ${entry.date}`}
                          value={entry.dutyStart || '08:30'}
                          onChange={(e) =>
                            updateEntry(idx, { dutyStart: e.target.value })
                          }
                          className="bg-transparent font-mono text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{STRINGS.roster.saveBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
