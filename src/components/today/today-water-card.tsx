'use client';

import React from 'react';
import { Droplets, RotateCcw } from 'lucide-react';
import { STRINGS } from '@/src/lib/strings';
import { Routine } from '@/src/lib/types';

interface TodayWaterCardProps {
  waterRoutine: Routine;
  waterValue: number;
  waterTarget: number;
  waterPercent: number;
  onAddWater: (delta: number) => void;
}

export function TodayWaterCard({
  waterValue,
  waterTarget,
  waterPercent,
  onAddWater,
}: TodayWaterCardProps) {
  return (
    <section
      data-testid="water-tracker-card"
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200/70 dark:border-sky-800/70 flex items-center justify-center shrink-0 mt-0.5">
            <Droplets className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {STRINGS.today.waterTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              Checkpoints: 11:00 (750ml) · 14:00 (1500ml) · 18:00 (2000ml)
            </p>
          </div>
        </div>
        <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-sky-700 dark:text-sky-300 whitespace-nowrap shrink-0">
          {waterValue} / {waterTarget} ml
        </span>
      </div>

      <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-sky-600 dark:bg-sky-500 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${waterPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => onAddWater(250)}
          className="min-h-[44px] py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white text-xs font-semibold font-mono tabular-nums transition-all cursor-pointer"
        >
          +250 ml
        </button>
        <button
          type="button"
          onClick={() => onAddWater(500)}
          className="min-h-[44px] py-2.5 px-3 rounded-xl bg-sky-700 hover:bg-sky-600 active:scale-[0.98] text-white text-xs font-semibold font-mono tabular-nums transition-all cursor-pointer"
        >
          +500 ml
        </button>
        <button
          type="button"
          disabled={waterValue <= 0}
          onClick={() => onAddWater(-250)}
          className="min-h-[44px] py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-xs font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo
        </button>
      </div>
    </section>
  );
}
