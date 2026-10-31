'use client';

import React from 'react';
import { LifeArea, GoalType } from '@/src/lib/types';

interface GoalsAddDrawerProps {
  showAddMenu: boolean;
  addMode: 'goal' | 'category';
  onSetAddMode: (mode: 'goal' | 'category') => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  // Category inputs
  newCategoryName: string;
  onChangeCategoryName: (val: string) => void;
  newCategoryDesc: string;
  onChangeCategoryDesc: (val: string) => void;
  // Goal inputs
  newGoalTitle: string;
  onChangeGoalTitle: (val: string) => void;
  newGoalAreaId: string;
  onChangeGoalAreaId: (val: string) => void;
  newGoalType: GoalType;
  onChangeGoalType: (val: GoalType) => void;
  activeLifeAreas: LifeArea[];
}

export function GoalsAddDrawer({
  showAddMenu,
  addMode,
  onSetAddMode,
  onClose,
  onSubmit,
  newCategoryName,
  onChangeCategoryName,
  newCategoryDesc,
  onChangeCategoryDesc,
  newGoalTitle,
  onChangeGoalTitle,
  newGoalAreaId,
  onChangeGoalAreaId,
  newGoalType,
  onChangeGoalType,
  activeLifeAreas,
}: GoalsAddDrawerProps) {
  if (!showAddMenu) return null;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-teal-600 p-5 sm:p-6 shadow-lg space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSetAddMode('goal')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold ${
              addMode === 'goal'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            + Naya Goal Jodo
          </button>
          <button
            type="button"
            onClick={() => onSetAddMode('category')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold ${
              addMode === 'category'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            + Nayi Category (e.g. Health, Finance)
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          Close
        </button>
      </div>

      {addMode === 'category' ? (
        <div className="space-y-3">
          <input
            type="text"
            required
            value={newCategoryName}
            onChange={(e) => onChangeCategoryName(e.target.value)}
            placeholder="Category Naam (e.g. Spiritual, Fitness, Side Business)..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-base"
          />
          <input
            type="text"
            value={newCategoryDesc}
            onChange={(e) => onChangeCategoryDesc(e.target.value)}
            placeholder="Short description (optional)..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
            >
              Category Save Karo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            required
            value={newGoalTitle}
            onChange={(e) => onChangeGoalTitle(e.target.value)}
            placeholder="Goal ka naam likhein..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-base"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={newGoalAreaId}
              onChange={(e) => onChangeGoalAreaId(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium"
            >
              {activeLifeAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  Category: {a.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeGoalType('outcome')}
                className={`min-h-[44px] rounded-xl text-xs font-bold border ${
                  newGoalType === 'outcome'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600'
                }`}
              >
                🎯 Goal
              </button>
              <button
                type="button"
                onClick={() => onChangeGoalType('ongoing_direction')}
                className={`min-h-[44px] rounded-xl text-xs font-bold border ${
                  newGoalType === 'ongoing_direction'
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600'
                }`}
              >
                ♾️ Ongoing Goal
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
            >
              Goal Add Karo & Plan Kholo →
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
