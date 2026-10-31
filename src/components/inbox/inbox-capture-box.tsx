'use client';

import React from 'react';
import {
  ArrowRight,
  Check,
  CornerDownRight,
  FolderKanban,
  Plus,
  SlidersHorizontal,
  Target,
  Trash2,
} from 'lucide-react';
import { Goal, GoalType, LifeArea } from '@/src/lib/types';
import { VoiceMicButton } from '@/src/components/voice-mic-button';

interface InputSuggestion {
  suggestedAreaId?: string | null;
  suggestedGoalId?: string | null;
  matchedReason?: string | null;
}

interface InboxCaptureBoxProps {
  captureText: string;
  onChangeCaptureText: (val: string) => void;
  onSubmitCapture: (e: React.FormEvent) => void;
  inputSuggestion: InputSuggestion;
  effectiveInputCategoryId?: string;
  onSelectCategory: (areaId: string) => void;
  activeLifeAreas: LifeArea[];
  showInputNewCategory: boolean;
  onToggleInputNewCategory: () => void;
  inputNewCategoryName: string;
  onChangeInputNewCategoryName: (val: string) => void;
  onCreateInputNewCategory: () => void;
  selectedInputAreaObj?: LifeArea;
  inputGoalType: GoalType;
  onChangeInputGoalType: (val: GoalType) => void;
  onCreateCategoryGoal: () => void;
  activeGoals: Goal[];
  effectiveInputGoalId: string;
  onSelectSpecificGoal: (goalId: string) => void;
  inputGoalStepType: 'milestone' | 'task';
  onChangeInputGoalStepType: (val: 'milestone' | 'task') => void;
  onMoveToSpecificGoal: () => void;
  onDirectMoveToTrash: () => void;
  trashedCount: number;
  showTrashView: boolean;
  onToggleTrashView: () => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function InboxCaptureBox({
  captureText,
  onChangeCaptureText,
  onSubmitCapture,
  inputSuggestion,
  effectiveInputCategoryId,
  onSelectCategory,
  activeLifeAreas,
  showInputNewCategory,
  onToggleInputNewCategory,
  inputNewCategoryName,
  onChangeInputNewCategoryName,
  onCreateInputNewCategory,
  selectedInputAreaObj,
  inputGoalType,
  onChangeInputGoalType,
  onCreateCategoryGoal,
  activeGoals,
  effectiveInputGoalId,
  onSelectSpecificGoal,
  inputGoalStepType,
  onChangeInputGoalStepType,
  onMoveToSpecificGoal,
  onDirectMoveToTrash,
  trashedCount,
  showTrashView,
  onToggleTrashView,
  onShowToast,
}: InboxCaptureBoxProps) {
  const hasTypedText = captureText.trim().length > 0;

  return (
    <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-2xs space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Brain Dump
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Jo bhi mann me aaye yahan khali kar dein — likhte hi aap Category, Specific Goal ya Trash bhi chun sakte hain.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <VoiceMicButton
            onTranscript={(spoken) =>
              onChangeCaptureText(
                captureText.trim() ? `${captureText.trim()} ${spoken}` : spoken
              )
            }
            onStatusMessage={(msg) => onShowToast(msg, 'info')}
          />
          {trashedCount > 0 && (
            <button
              type="button"
              onClick={onToggleTrashView}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 shrink-0 ${
                showTrashView
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-50/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {showTrashView ? '← Brain Dump List' : `Trash (${trashedCount})`}
              </span>
            </button>
          )}
        </div>
      </div>

      <form onSubmit={onSubmitCapture} className="space-y-5">
        {/* Large Minimalist Brain Dump Box */}
        <textarea
          rows={4}
          value={captureText}
          onChange={(e) => onChangeCaptureText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              onSubmitCapture(e);
            }
          }}
          placeholder="Yahan kuch bhi likhein — koi vichaar, goal, kaam, chinta ya naya idea..."
          aria-label="Brain Dump Box"
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#FAF8F5]/80 dark:bg-slate-950/70 p-5 text-base sm:text-lg leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-slate-950 focus:ring-3 focus:ring-teal-600/15 transition-all resize-y"
        />

        {/* CONTEXTUAL MENU: Appears automatically as soon as the user types an item */}
        {hasTypedText && (
          <div
            data-testid="brain-dump-input-contextual-menu"
            className="rounded-2xl bg-slate-50/80 dark:bg-slate-950/80 border border-teal-600/25 dark:border-teal-500/25 p-5 space-y-5 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
                  Contextual Quick Filter
                </span>
                {inputSuggestion.matchedReason && (
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-teal-100/80 dark:bg-teal-950 text-teal-800 dark:text-teal-300">
                    Auto-hint: {inputSuggestion.matchedReason}
                  </span>
                )}
              </div>

              {/* Direct Move to Trash button right in the contextual menu */}
              <button
                type="button"
                onClick={onDirectMoveToTrash}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-rose-50/80 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200/80 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bekar Hai → Seedha Trash</span>
              </button>
            </div>

            {/* A. Assign a Category OR Create a New Goal in that Category */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-teal-600" />
                  <span>1. Category Assign Karein (Optional):</span>
                </label>
                <button
                  type="button"
                  onClick={onToggleInputNewCategory}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>
                    {showInputNewCategory ? 'Cancel' : '+ Naya Category'}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectCategory('')}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    !effectiveInputCategoryId
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-slate-800'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  Bina Category (Sirf Save)
                </button>
                {activeLifeAreas.map((area) => {
                  const isSelected = effectiveInputCategoryId === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => onSelectCategory(area.id)}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-teal-500'
                      }`}
                    >
                      <span>{area.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>

              {showInputNewCategory && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={inputNewCategoryName}
                    onChange={(e) => onChangeInputNewCategoryName(e.target.value)}
                    placeholder="Naya Category naam (e.g. Fitness, Study)..."
                    className="flex-1 min-h-[38px] rounded-xl border border-teal-500 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={onCreateInputNewCategory}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-semibold"
                  >
                    Add Category
                  </button>
                </div>
              )}

              {selectedInputAreaObj && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-teal-900 dark:text-teal-200">
                      Category: <strong>{selectedInputAreaObj.name}</strong>
                    </span>
                    <div className="inline-flex rounded-lg border border-teal-300/80 dark:border-teal-800 bg-white dark:bg-slate-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => onChangeInputGoalType('outcome')}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                          inputGoalType === 'outcome'
                            ? 'bg-teal-700 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Goal
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeInputGoalType('ongoing_direction')}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                          inputGoalType === 'ongoing_direction'
                            ? 'bg-teal-700 text-white'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Ongoing Goal
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onCreateCategoryGoal}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>
                      Seedha {selectedInputAreaObj.name} Goal Banao →
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* B. Move Directly to a Specific Existing Goal */}
            {activeGoals.length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-slate-200/70 dark:border-slate-800/80">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    2. Ya Seedha Kisi Specific Goal ke Andar Move Karein:
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    aria-label="Select Specific Goal for Brain Dump item"
                    value={effectiveInputGoalId}
                    onChange={(e) => onSelectSpecificGoal(e.target.value)}
                    className="sm:col-span-7 w-full min-w-0 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                  >
                    {activeGoals.map((g) => {
                      const areaName =
                        activeLifeAreas.find((a) => a.id === g.lifeAreaId)?.name ||
                        'Goal';
                      return (
                        <option key={g.id} value={g.id}>
                          [{areaName}] {g.title}
                        </option>
                      );
                    })}
                  </select>

                  <div className="sm:col-span-5 flex items-center gap-1.5">
                    <select
                      aria-label="Goal addition mode"
                      value={inputGoalStepType}
                      onChange={(e) =>
                        onChangeInputGoalStepType(
                          e.target.value as 'milestone' | 'task'
                        )
                      }
                      className="flex-1 min-w-0 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      <option value="milestone">As Plan Step</option>
                      <option value="task">As Daily Task</option>
                    </select>

                    <button
                      type="button"
                      onClick={onMoveToSpecificGoal}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <span>Move</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wide "Relax" Pill Button right below the box */}
        <div className="flex justify-center pt-1">
          <button
            type="submit"
            disabled={!hasTypedText}
            className="w-full sm:w-80 min-h-[50px] px-8 py-3 rounded-full bg-teal-700 hover:bg-teal-600 active:scale-[0.99] disabled:opacity-40 text-white text-lg font-bold tracking-wide shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <span>Relax</span>
            <span className="text-xs font-normal text-teal-100">
              (Sirf Save Karein)
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
