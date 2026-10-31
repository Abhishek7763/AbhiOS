'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Check,
  AlertCircle,
  ArrowRight,
  Mic,
  MicOff,
  Tag,
  Plus,
  Trash2,
  CornerDownRight,
  FolderKanban,
} from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { STRINGS } from '@/src/lib/strings';
import { evaluateGoalCandidateGate } from '@/src/lib/logic/quality-gate';
import { suggestContextualBrainDumpMatch } from '@/src/lib/logic/planner';
import { GoalType } from '@/src/lib/types';

const PRESET_CAPTURE_TAGS = [
  '#health',
  '#relationship',
  '#finance',
  '#duty-career',
  '#family',
  '#daily-system',
  '#peace',
  '#learning',
];

export function QuickCaptureModal() {
  const {
    state,
    quickCaptureOpen,
    setQuickCaptureOpen,
    quickCaptureInitialText,
    setQuickCaptureInitialText,
    quickCapture,
    captureAndMoveToGoal,
    setActiveTab,
    showToast,
  } = useGoalOs();
  const [text, setText] = useState('');

  useEffect(() => {
    if (quickCaptureOpen && quickCaptureInitialText) {
      queueMicrotask(() => {
        setText(quickCaptureInitialText);
        setQuickCaptureInitialText('');
      });
    }
  }, [quickCaptureOpen, quickCaptureInitialText, setQuickCaptureInitialText]);
  const [selectedCategoryOverride, setSelectedCategoryOverride] = useState<
    string | null
  >(null);
  const [selectedGoalOverride, setSelectedGoalOverride] = useState<string>('');
  const [stepType, setStepType] = useState<'milestone' | 'task'>('milestone');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const activeLifeAreas = useMemo(
    () => state.lifeAreas.filter((a) => a.status === 'active'),
    [state.lifeAreas]
  );

  const activeGoals = useMemo(
    () => state.goals.filter((g) => g.status === 'active'),
    [state.goals]
  );

  const suggestion = useMemo(
    () =>
      suggestContextualBrainDumpMatch(text, activeLifeAreas, activeGoals),
    [text, activeLifeAreas, activeGoals]
  );

  const effectiveAreaId =
    selectedCategoryOverride !== null
      ? selectedCategoryOverride
      : suggestion.suggestedAreaId;

  const effectiveGoalId =
    selectedGoalOverride ||
    suggestion.suggestedGoalId ||
    activeGoals[0]?.id ||
    '';

  // Global keyboard shortcut: Ctrl+K or Cmd+K to open Brain Dump from anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickCaptureOpen(!quickCaptureOpen);
      } else if (e.key === 'Escape' && quickCaptureOpen) {
        setQuickCaptureOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickCaptureOpen, setQuickCaptureOpen]);

  const toggleVoiceCapture = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionApi =
      typeof window !== 'undefined'
        ? (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionApi) {
      showToast(
        'Is browser me direct Voice Recognition उपलब्ध nahi hai — keyboard mic ya text use karein.',
        'info'
      );
      return;
    }

    try {
      const recognition = new (SpeechRecognitionApi as new () => {
        lang: string;
        interimResults: boolean;
        continuous: boolean;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();
      recognition.lang = 'hi-IN';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
          setText((prev) =>
            prev.trim()
              ? `${prev.trim()} ${transcript.trim()}`
              : transcript.trim()
          );
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  if (!quickCaptureOpen) return null;

  const resetModal = () => {
    setText('');
    setSelectedCategoryOverride(null);
    setSelectedGoalOverride('');
    setQuickCaptureOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    quickCapture(text, 'quick_capture', {
      lifeAreaId: effectiveAreaId || null,
    });
    resetModal();
  };

  const handleMoveDirectlyToGoal = () => {
    if (!text.trim() || !effectiveGoalId) return;
    captureAndMoveToGoal(text.trim(), effectiveGoalId, stepType);
    resetModal();
    setActiveTab('goals');
  };

  const handleMoveDirectlyToTrash = () => {
    if (!text.trim()) return;
    quickCapture(text, 'quick_capture', {
      status: 'trash',
      decisionNote: 'Quick Brain Dump se seedha Trash me daala gaya',
    });
    resetModal();
  };

  const hasText = text.trim().length > 0;
  const selectedAreaName = activeLifeAreas.find(
    (a) => a.id === effectiveAreaId
  )?.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-capture-title"
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-6 shadow-xl">
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="quick-capture-title"
                className="text-xl font-bold text-slate-900 dark:text-slate-100"
              >
                Brain Dump
              </h2>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline">
                Ctrl+K
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Jo bhi mann me aaye yahan likh dein — likhte hi Category, Goal ya Trash chun sakte hain.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQuickCaptureOpen(false)}
            aria-label="Close Brain Dump"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            rows={4}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Yahan kuch bhi likhein — koi vichaar, goal, kaam ya idea..."
            aria-label="Brain dump thought input"
            className="w-full rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-[#FAF8F5] dark:bg-slate-950 p-4 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all"
          />

          {/* CONTEXTUAL MENU: Appears when user types */}
          {hasText && (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-teal-600/30 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 text-teal-600" />
                  <span>Category Assign (Optional):</span>
                </span>
                <button
                  type="button"
                  onClick={handleMoveDirectlyToTrash}
                  className="min-h-[30px] px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Trash</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryOverride('')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    !effectiveAreaId
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-slate-800'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  None
                </button>
                {activeLifeAreas.map((area) => {
                  const isSelected = effectiveAreaId === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setSelectedCategoryOverride(area.id)}
                      className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                        isSelected
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {area.name}
                    </button>
                  );
                })}
              </div>

              {activeGoals.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <CornerDownRight className="w-3.5 h-3.5 text-teal-600" />
                    <span>Ya Seedha Specific Goal me Move Karein:</span>
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      aria-label="Quick capture target goal"
                      value={effectiveGoalId}
                      onChange={(e) => setSelectedGoalOverride(e.target.value)}
                      className="flex-1 min-h-[36px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium"
                    >
                      {activeGoals.map((g) => {
                        const aName =
                          state.lifeAreas.find((a) => a.id === g.lifeAreaId)
                            ?.name || 'Goal';
                        return (
                          <option key={g.id} value={g.id}>
                            [{aName}] {g.title}
                          </option>
                        );
                      })}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label="Quick capture goal item mode"
                        value={stepType}
                        onChange={(e) =>
                          setStepType(
                            e.target.value as 'milestone' | 'task'
                          )
                        }
                        className="min-h-[36px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="milestone">Plan Step</option>
                        <option value="task">Daily Task</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleMoveDirectlyToGoal}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                      >
                        <span>Move to Goal</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleVoiceCapture}
              aria-label="Voice Brain Dump Dictation"
              className={`min-h-[46px] px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Sun Raha Hai...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Voice</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={!hasText}
              className="flex-1 min-h-[48px] px-6 py-2.5 rounded-full text-sm sm:text-base font-bold text-white bg-teal-700 hover:bg-teal-600 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>
                {selectedAreaName
                  ? `Relax — Save (${selectedAreaName})`
                  : 'Relax — Save Thought'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GoalQualityGateModal() {
  const {
    state,
    activeQualityGateGoalId,
    setActiveQualityGateGoalId,
    resolveGoalCandidateGate,
    createLifeArea,
    requestAiSuggestion,
  } = useGoalOs();

  const candidate = state.goals.find((g) => g.id === activeQualityGateGoalId);

  const [title, setTitle] = useState('');
  const [lifeAreaId, setLifeAreaId] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [purposeReason, setPurposeReason] = useState('');
  const [ownershipReflection, setOwnershipReflection] = useState('');
  const [evidenceOfProgress, setEvidenceOfProgress] = useState('');
  const [controlNotes, setControlNotes] = useState('');
  const [tradeoffs, setTradeoffs] = useState('');
  const [capacityNotes, setCapacityNotes] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('outcome');
  const [targetDate, setTargetDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [firstNextAction, setFirstNextAction] = useState('');
  const [gateTags, setGateTags] = useState<string[]>([]);
  const [customGateTag, setCustomGateTag] = useState('');
  const [addingNewArea, setAddingNewArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    if (!candidate) return;
    queueMicrotask(() => {
      setTitle(candidate.title || '');
      setLifeAreaId(
        candidate.lifeAreaId || state.lifeAreas[0]?.id || 'area-personal'
      );
      setDesiredOutcome(candidate.desiredOutcome || candidate.title || '');
      setPurposeReason(candidate.purposeReason || '');
      setOwnershipReflection(candidate.ownershipReflection || '');
      setEvidenceOfProgress(candidate.evidenceOfProgress || '');
      setControlNotes(candidate.controlNotes || '');
      setTradeoffs(candidate.tradeoffs || '');
      setCapacityNotes(candidate.capacityNotes || '');
      setGoalType(candidate.goalType || 'outcome');
      setTargetDate(candidate.targetDate || '');
      setReviewDate(candidate.reviewDate || '');
      setFirstNextAction(candidate.capacityNotes || '');
      setGateTags(candidate.tags || []);
      setCustomGateTag('');
      setAddingNewArea(false);
      setNewAreaName('');
      setAiNote(null);
    });
  }, [candidate, state.lifeAreas]);

  if (!candidate) return null;

  const toggleGateTag = (tag: string) => {
    const clean = tag.startsWith('#') ? tag.toLowerCase() : `#${tag.toLowerCase()}`;
    setGateTags((prev) =>
      prev.includes(clean) ? prev.filter((t) => t !== clean) : [...prev, clean]
    );
  };

  const handleAddCustomGateTag = () => {
    const raw = customGateTag.trim().replace(/^#+/, '').toLowerCase();
    if (!raw) return;
    const formatted = `#${raw}`;
    if (!gateTags.includes(formatted)) {
      setGateTags((prev) => [...prev, formatted]);
    }
    setCustomGateTag('');
  };

  const handleCreateInlineArea = () => {
    if (!newAreaName.trim()) return;
    const created = createLifeArea(newAreaName.trim());
    if (created) {
      setLifeAreaId(created.id);
      setNewAreaName('');
      setAddingNewArea(false);
    }
  };

  const activeGoalsCount = state.goals.filter(
    (g) => g.status === 'active'
  ).length;

  const gateEval = evaluateGoalCandidateGate(
    {
      title,
      desiredOutcome,
      purposeReason,
      lifeAreaId,
      tradeoffs,
      capacityNotes: firstNextAction || capacityNotes,
    },
    activeGoalsCount
  );

  const handleAiAssist = async () => {
    setAiLoading(true);
    try {
      const { aiUsed, reason, draft } = await requestAiSuggestion(
        'goal_gate_assist',
        `${title}\n${desiredOutcome}`,
        { lifeAreaId }
      );
      if (draft.refinedTitle && !desiredOutcome) {
        setDesiredOutcome(draft.refinedTitle);
      }
      if (draft.purposeReason && !purposeReason) {
        setPurposeReason(draft.purposeReason);
      }
      if (draft.tradeoffs && !tradeoffs) {
        setTradeoffs(draft.tradeoffs);
      }
      if (draft.nextAction && !firstNextAction) {
        setFirstNextAction(draft.nextAction);
      }
      const fallbackSuffix =
        !aiUsed && reason && reason !== 'no_key'
          ? ` (${STRINGS.inbox.aiFallbackNotice(reason)})`
          : '';
      setAiNote(
        aiUsed
          ? `Gemini AI Sujhaav: ${draft.explanation || 'Fields draft kiye gaye hain — aap edit karke faisla lein.'}`
          : `${draft.explanation || 'Rule-based reflection draft taiyaar hai.'}${fallbackSuffix}`
      );
    } finally {
      setAiLoading(false);
    }
  };

  const buildPatch = () => ({
    title: title.trim() || candidate.title,
    lifeAreaId,
    desiredOutcome: desiredOutcome.trim(),
    purposeReason: purposeReason.trim(),
    ownershipReflection: ownershipReflection.trim(),
    evidenceOfProgress: evidenceOfProgress.trim(),
    controlNotes: controlNotes.trim(),
    tradeoffs: tradeoffs.trim(),
    capacityNotes: firstNextAction.trim() || capacityNotes.trim(),
    tags: gateTags,
    goalType,
    targetDate: targetDate || null,
    reviewDate: reviewDate || candidate.reviewDate,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quality-gate-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
              V2 Goal Candidate Review · Provenance:{' '}
              {candidate.originInboxItemId
                ? `From Brain Dump (${candidate.originInboxItemId})`
                : 'Direct Candidate'}
            </p>
            <h2
              id="quality-gate-modal-title"
              className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              {STRINGS.qualityGate.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {STRINGS.qualityGate.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveQualityGateGoalId(null)}
            aria-label="Close Goal Quality Gate"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Advisories */}
        {gateEval.activeGoalCountWarning && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>{STRINGS.qualityGate.activeCapWarning(activeGoalsCount)}</span>
          </div>
        )}

        {gateEval.advisorySleepOnIt && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-700 dark:text-slate-300">
            {STRINGS.qualityGate.sleepOnItBanner}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            9-Point Adaptive Quality Check (Aap hamesha final decision lete hain)
          </span>
          <button
            type="button"
            onClick={handleAiAssist}
            disabled={aiLoading}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-teal-600/30 bg-teal-50/70 dark:bg-teal-950/50 text-xs font-medium text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? 'Soch raha hai...' : 'AI Reflection Prompts Fill Karo'}
          </button>
        </div>

        {aiNote && (
          <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/30 p-3 text-xs text-teal-900 dark:text-teal-200">
            {aiNote}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Goal Candidate Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Field / Department (Life Area)
              </label>
              <button
                type="button"
                onClick={() => setAddingNewArea((prev) => !prev)}
                className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {addingNewArea ? 'Cancel' : '+ Naya Field'}
              </button>
            </div>
            {addingNewArea ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="e.g. Spiritual, Fitness..."
                  className="flex-1 min-h-[44px] rounded-xl border border-teal-500 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleCreateInlineArea}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-teal-700 text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            ) : (
              <select
                value={lifeAreaId}
                onChange={(e) => setLifeAreaId(e.target.value)}
                aria-label="Life Area"
                className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
              >
                {state.lifeAreas
                  .filter((a) => a.status === 'active')
                  .map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q8_horizon}
            </label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as GoalType)}
              aria-label="Goal Horizon Type"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
            >
              <option value="outcome">Time-Bound Outcome (Finish line hai)</option>
              <option value="ongoing_direction">
                Ongoing Direction / System (No deadline needed)
              </option>
            </select>
          </div>

          {/* Goal Labels / #Tags Picker inside Quality Gate */}
          <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Goal Labels / Tags (Filter by Field & Category):
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_CAPTURE_TAGS.map((tag) => {
                const active = gateTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleGateTag(tag)}
                    className={`min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-400'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {gateTags
                .filter((t) => !PRESET_CAPTURE_TAGS.includes(t))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleGateTag(tag)}
                    className="min-h-[28px] px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-teal-700 text-white border-teal-700"
                  >
                    {tag} ×
                  </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customGateTag}
                onChange={(e) => setCustomGateTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomGateTag();
                  }
                }}
                placeholder="Custom label jodein (e.g. #marriage, #fitness)..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddCustomGateTag}
                className="min-h-[28px] px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                + Add Tag
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q1_outcome} *
            </label>
            <textarea
              rows={2}
              value={desiredOutcome}
              onChange={(e) => setDesiredOutcome(e.target.value)}
              placeholder="Apne shabdon me saaf likhein ki kya badlav chahiye..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q2_reason} *
            </label>
            <textarea
              rows={2}
              value={purposeReason}
              onChange={(e) => setPurposeReason(e.target.value)}
              placeholder="Ye aapki zindagi me kyun maayne rakhta hai?"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q3_ownership}
            </label>
            <input
              type="text"
              value={ownershipReflection}
              onChange={(e) => setOwnershipReflection(e.target.value)}
              placeholder="Apni zarurat vs doosron ka expectation..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q4_evidence}
            </label>
            <input
              type="text"
              value={evidenceOfProgress}
              onChange={(e) => setEvidenceOfProgress(e.target.value)}
              placeholder="Kaise pata chalega ki sahi disha me hain?"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q5_control}
            </label>
            <input
              type="text"
              value={controlNotes}
              onChange={(e) => setControlNotes(e.target.value)}
              placeholder="Mere control me kya hai?"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q6_tradeoffs}
            </label>
            <input
              type="text"
              value={tradeoffs}
              onChange={(e) => setTradeoffs(e.target.value)}
              placeholder="Kya kam ya pause karna padega?"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {STRINGS.qualityGate.questions.q7_capacity}
            </label>
            <input
              type="text"
              value={firstNextAction}
              onChange={(e) => setFirstNextAction(e.target.value)}
              placeholder="Sabse chhota agla kadam (ya likhein: 'Abhi next step unclear hai')"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-base text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Optional Target Date (Ongoing ke liye khali chhod dein)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Next Review Date
            </label>
            <input
              type="date"
              value={reviewDate}
              onChange={(e) => setReviewDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-100 font-mono tabular-nums"
            />
          </div>
        </div>

        {!gateEval.isReadyToAccept && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Active Goal banane ke liye zaruri:{' '}
            {gateEval.missingFields.join(' · ')}
          </p>
        )}

        {/* Section 2: 6 Explicit Goal Acceptance Outcomes */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {STRINGS.qualityGate.questions.q9_check} — Apna Faisla Chunein:
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={!gateEval.isReadyToAccept}
              onClick={() =>
                resolveGoalCandidateGate(
                  candidate.id,
                  'accept',
                  buildPatch(),
                  firstNextAction
                )
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              {STRINGS.qualityGate.outcomes.accept}
            </button>

            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(candidate.id, 'refine', buildPatch())
              }
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {STRINGS.qualityGate.outcomes.refine}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(
                  candidate.id,
                  'convert_project',
                  buildPatch()
                )
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {STRINGS.qualityGate.outcomes.convertProject}
            </button>

            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(
                  candidate.id,
                  'convert_task',
                  buildPatch(),
                  firstNextAction
                )
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {STRINGS.qualityGate.outcomes.convertTask}
            </button>

            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(
                  candidate.id,
                  'convert_habit',
                  buildPatch()
                )
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {STRINGS.qualityGate.outcomes.convertHabit}
            </button>

            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(candidate.id, 'someday', buildPatch())
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
            >
              {STRINGS.qualityGate.outcomes.someday}
            </button>

            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(
                  candidate.id,
                  'reference',
                  buildPatch()
                )
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
            >
              {STRINGS.qualityGate.outcomes.reference}
            </button>

            <button
              type="button"
              onClick={() =>
                resolveGoalCandidateGate(candidate.id, 'decline', buildPatch())
              }
              className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300 whitespace-nowrap"
            >
              {STRINGS.qualityGate.outcomes.decline}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
