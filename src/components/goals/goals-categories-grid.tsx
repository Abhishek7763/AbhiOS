'use client';

import React from 'react';
import { LifeArea, Goal } from '@/src/lib/types';

interface GoalsCategoriesGridProps {
  activeLifeAreas: LifeArea[];
  visibleGoals: Goal[];
  selectedAreaId: string;
  onSelectAreaId: (areaId: string) => void;
  editingCategoriesMode: boolean;
  renamingAreaId: string | null;
  renamingAreaText: string;
  onStartRenameArea: (areaId: string, currentName: string) => void;
  onChangeRenameText: (text: string) => void;
  onSaveRenameArea: (areaId: string) => void;
  onCancelRenameArea: () => void;
}

export function GoalsCategoriesGrid({
  activeLifeAreas,
  visibleGoals,
  selectedAreaId,
  onSelectAreaId,
  editingCategoriesMode,
  renamingAreaId,
  renamingAreaText,
  onStartRenameArea,
  onChangeRenameText,
  onSaveRenameArea,
  onCancelRenameArea,
}: GoalsCategoriesGridProps) {
  return (
    <div className="space-y-3 pt-1">
      <div className="space-y-2.5" role="list" aria-label="Goal Categories">
        {activeLifeAreas.map((area) => {
          const count = visibleGoals.filter(
            (g) => g.lifeAreaId === area.id
          ).length;
          const isSelected = selectedAreaId === area.id;
          const isRenaming = renamingAreaId === area.id;

          return (
            <div key={area.id} role="listitem">
              {isRenaming ? (
                <div className="flex items-center gap-2 rounded-2xl border-2 border-teal-600 bg-slate-50 dark:bg-slate-950 px-4 py-2.5">
                  <input
                    type="text"
                    value={renamingAreaText}
                    onChange={(e) => onChangeRenameText(e.target.value)}
                    className="flex-1 bg-transparent text-base font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => onSaveRenameArea(area.id)}
                    className="min-h-[36px] px-3 py-1 rounded-xl bg-teal-700 text-white text-xs font-semibold"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={onCancelRenameArea}
                    className="min-h-[36px] px-2.5 py-1 text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectAreaId(area.id)}
                    className={`w-full min-h-[54px] px-5 py-3.5 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-teal-700 bg-teal-50/70 dark:bg-teal-950/50 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-base sm:text-lg font-bold tracking-tight">
                      {area.name}
                    </span>
                    <span
                      className={`text-base sm:text-lg font-mono font-bold tabular-nums px-3 py-0.5 rounded-xl ${
                        isSelected
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {editingCategoriesMode && (
                    <button
                      type="button"
                      onClick={() => onStartRenameArea(area.id, area.name)}
                      className="min-h-[54px] px-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-slate-50 shrink-0"
                    >
                      Rename
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
