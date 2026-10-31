'use client';

import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Cloud,
  Download,
  Lock,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import { useGoalOs } from '@/src/context/goal-os-context';
import { usePWAInstall, usePushReminders } from '@/src/hooks/use-pwa';
import { STRINGS } from '@/src/lib/strings';
import { RoutineAnchorType, RoutineAppliesOn, RoutineBlock } from '@/src/lib/types';
import { RoutineInsightsCard } from '@/src/components/routine-insights-card';

export function SettingsView() {
  const {
    state,
    today,
    user,
    cloudSynced,
    pendingSyncCount,
    aiAvailable,
    darkMode,
    toggleDarkMode,
    signInWithGoogle,
    logoutUser,
    syncWithSupabaseNow,
    supabaseConfigured,
    updateSettings,
    createRoutine,
    updateRoutine,
    reorderRoutine,
    exportBackupJson,
    importBackupJson,
    simulateGapDays,
    showToast,
  } = useGoalOs();

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const {
    status: pushStatus,
    busy: pushBusy,
    enablePush,
    disablePush,
    sendTestPush,
  } = usePushReminders(user);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Local settings form overrides (fall back to live state.settings until edited)
  const [timezoneDraft, setTimezone] = useState<string | null>(null);
  const [wakeTimeDraft, setWakeTime] = useState<string | null>(null);
  const [quietStartDraft, setQuietStart] = useState<string | null>(null);
  const [quietEndDraft, setQuietEnd] = useState<string | null>(null);
  const [dayRolloverHourDraft, setDayRolloverHour] = useState<number | null>(
    null
  );
  const [dailyWorkloadMinutesDraft, setDailyWorkloadMinutes] = useState<
    number | null
  >(null);
  const [dutyPromptTimeDraft, setDutyPromptTime] = useState<string | null>(
    null
  );
  const [reviewTimeDraft, setReviewTime] = useState<string | null>(null);
  const [maxRemindersPerDayDraft, setMaxRemindersPerDay] = useState<
    number | null
  >(null);

  const timezone = timezoneDraft ?? state.settings.timezone;
  const wakeTime = wakeTimeDraft ?? state.settings.wakeTime;
  const quietStart = quietStartDraft ?? state.settings.quietStart;
  const quietEnd = quietEndDraft ?? state.settings.quietEnd;
  const dayRolloverHour =
    dayRolloverHourDraft ?? state.settings.dayRolloverHour;
  const dailyWorkloadMinutes =
    dailyWorkloadMinutesDraft ?? state.settings.dailyWorkloadMinutes;
  const dutyPromptTime = dutyPromptTimeDraft ?? state.settings.dutyPromptTime;
  const reviewTime = reviewTimeDraft ?? state.settings.reviewTime;
  const maxRemindersPerDay =
    maxRemindersPerDayDraft ?? state.settings.maxRemindersPerDay;

  // Routine Creator State
  const [rtTitle, setRtTitle] = useState('');
  const [rtBlock, setRtBlock] = useState<RoutineBlock>('morning');
  const [rtAnchor, setRtAnchor] = useState<RoutineAnchorType>('clock');
  const [rtClockTime, setRtClockTime] = useState('07:00');
  const [rtOffset, setRtOffset] = useState(0);
  const [rtAppliesOn, setRtAppliesOn] = useState<RoutineAppliesOn>('all');
  const [rtIsMust, setRtIsMust] = useState(true);

  // Reminder Engine Live Simulator Result
  const [tickResult, setTickResult] = useState<{
    todayDate: string;
    nowMin: number;
    skippedQuietHours: boolean;
    skippedCapReached: boolean;
    dueCount: number;
    digestNotification: {
      title: string;
      body: string;
      actions: Array<{ action: string; title: string; token: string | null }>;
    } | null;
  } | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      timezone: 'Asia/Kolkata',
      wakeTime,
      quietStart,
      quietEnd,
      dayRolloverHour,
      dailyWorkloadMinutes,
      dutyPromptTime,
      reviewTime,
      maxRemindersPerDay,
    });
  };

  const handleDownloadExport = () => {
    const payload = exportBackupJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goal-os-backup-${payload.exported_at.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON download ho gaya!', 'success');
  };

  const handleFileImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'merge' | 'replace-empty'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      importBackupJson(parsed, mode);
    } catch {
      showToast('Invalid JSON file.', 'error');
    }
    e.target.value = '';
  };

  const handleRunReminderTickTest = async (simulatedTimeMinutes?: number) => {
    if (!user) {
      showToast(
        'Reminder preview ke liye pehle PIN ya ID se login karein.',
        'warning'
      );
      return;
    }
    try {
      const token = user.getIdToken ? await user.getIdToken() : '';
      const res = await fetch('/api/reminders/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          overrideNowMin: simulatedTimeMinutes,
        }),
      });
      if (!res.ok) {
        showToast('Reminder preview unauthorized ya unavailable hai.', 'warning');
        return;
      }
      const data = await res.json();
      setTickResult(data);
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        data.digestNotification
      ) {
        new Notification(data.digestNotification.title, {
          body: data.digestNotification.body,
        });
      }
      showToast('Reminder tick check complete!', 'info');
    } catch {
      showToast('Reminder preview failed.', 'error');
    }
  };

  const handleEnablePush = async () => {
    if (!user) {
      showToast(STRINGS.reminders.signInRequired, 'warning');
      return;
    }
    const res = await enablePush();
    if (res.ok) {
      updateSettings({ pushEnabled: true });
      showToast(STRINGS.reminders.enabledToast, 'success');
    } else if (res.reason === 'no_vapid') {
      showToast(STRINGS.reminders.missingVapidKey, 'error');
    } else if (res.reason === 'denied') {
      showToast(STRINGS.reminders.status.denied, 'warning');
    } else {
      showToast('Push subscription fail hua.', 'error');
    }
  };

  const handleDisablePush = async () => {
    const res = await disablePush();
    updateSettings({ pushEnabled: false });
    if (res.ok) {
      showToast(STRINGS.reminders.disabledToast, 'info');
    }
  };

  const handleTestPush = async () => {
    if (!user) {
      showToast(STRINGS.reminders.signInRequired, 'warning');
      return;
    }
    const res = await sendTestPush();
    if (res.ok) {
      showToast(STRINGS.reminders.testSentToast, 'success');
    } else {
      showToast(STRINGS.reminders.testFailToast, 'warning');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Supabase Cloud Sync, Active User & Theme */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Settings & Cloud Sync
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800">
                {supabaseConfigured ? 'Supabase Active' : 'Offline Cache Ready'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-1">
              User: <span className="text-teal-700 dark:text-teal-300 font-semibold">{user?.email || 'Abhishek'}</span> · Sync:{' '}
              {cloudSynced ? 'Cloud Synced' : 'Saved Locally'}{' '}
              ({STRINGS.sync.pendingLabel(pendingSyncCount)})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Supabase 1-tap sync button */}
            <button
              type="button"
              onClick={() => void syncWithSupabaseNow()}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-2 shadow-2xs"
            >
              <Cloud className="w-4 h-4" />
              <span>Sync to Cloud Now</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  Dark Mode
                </>
              )}
            </button>

            {/* In-App PWA Install Button */}
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Install App (PWA)
              </button>
            )}
            {!isInstalled && isIOS && (
              <button
                type="button"
                onClick={() => setShowIosGuide((v) => !v)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Install on iOS
              </button>
            )}

            {/* Sign Out Button */}
            {user && (
              <button
                type="button"
                onClick={logoutUser}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 hover:bg-rose-100 dark:hover:bg-rose-900/50"
              >
                <LogOut className="w-4 h-4" />
                Lock / Sign Out
              </button>
            )}
          </div>
        </div>

        {showIosGuide && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3.5 text-xs text-slate-700 dark:text-slate-300">
            Safari toolbar me <strong>Share</strong> dabayein aur{' '}
            <strong>Add to Home Screen</strong> chunein.
          </div>
        )}
      </section>

      {/* 2. Timezone, Rollover Hour, Quiet Hours & Daily Capacity */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Time, Rollover & Reminder Preferences
          </h2>
          <Cloud className="w-4 h-4 text-teal-600" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Timezone (India IST)
              </label>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Auto Synced
              </span>
            </div>
            <div className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-850 px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 flex items-center justify-between shadow-2xs">
              <span className="font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Asia/Kolkata (IST +05:30)
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Locked
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Internet network time se automatically synced hai (galti hone se bachane ke liye uneditable).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Wake Time
            </label>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Day Rollover Hour (0-8 AM)
            </label>
            <input
              type="number"
              min={0}
              max={8}
              value={dayRolloverHour}
              onChange={(e) => setDayRolloverHour(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quiet Hours Start
            </label>
            <input
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quiet Hours End
            </label>
            <input
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Daily Workload Budget (Min)
            </label>
            <input
              type="number"
              min={15}
              max={720}
              value={dailyWorkloadMinutes}
              onChange={(e) => setDailyWorkloadMinutes(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Duty Prompt Time
            </label>
            <input
              type="time"
              value={dutyPromptTime}
              onChange={(e) => setDutyPromptTime(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Evening Review Time
            </label>
            <input
              type="time"
              value={reviewTime}
              onChange={(e) => setReviewTime(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Max Reminders / Day
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={maxRemindersPerDay}
              onChange={(e) => setMaxRemindersPerDay(Number(e.target.value))}
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* 3. Routines Manage (Section 8.7) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Routines Manager (Brush, Bath, Ready for Duty, Water)
        </h2>

        {/* Calm Routine Insights & Reflections */}
        <RoutineInsightsCard
          routines={state.routines}
          logs={state.routineLogs}
          today={today}
          dayPlans={state.dayPlans}
        />

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
          {[...state.routines]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((rt, idx) => (
              <div
                key={rt.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {rt.title}
                  </p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    Block: {rt.block} · Anchor: {rt.anchorType} (
                    {rt.anchorType === 'clock'
                      ? rt.clockTime
                      : `${rt.anchorOffsetMin >= 0 ? '+' : ''}${rt.anchorOffsetMin}m`}
                    ) · Applies: {rt.appliesOn}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateRoutine(rt.id, { isMust: !rt.isMust })}
                    className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-medium border ${
                      rt.isMust
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600/40 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    {rt.isMust ? 'Must (Min Day)' : 'Optional'}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateRoutine(rt.id, { active: !rt.active })}
                    className="min-h-[38px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    {rt.active ? 'Active' : 'Paused'}
                  </button>

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => reorderRoutine(rt.id, 'up')}
                    aria-label="Move routine up"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === state.routines.length - 1}
                    onClick={() => reorderRoutine(rt.id, 'down')}
                    aria-label="Move routine down"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* Add New Routine Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <input
            type="text"
            value={rtTitle}
            onChange={(e) => setRtTitle(e.target.value)}
            placeholder="Naya Routine Title..."
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-base"
          />
          <select
            value={rtBlock}
            onChange={(e) => setRtBlock(e.target.value as RoutineBlock)}
            className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="morning">Morning Block</option>
            <option value="duty">Duty Block</option>
            <option value="evening">Evening Block</option>
            <option value="anytime">Anytime Block</option>
          </select>
          <select
            value={rtAnchor}
            onChange={(e) => setRtAnchor(e.target.value as RoutineAnchorType)}
            className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="clock">Clock Time</option>
            <option value="wake">Wake Time + Offset</option>
            <option value="duty_start">Duty Start + Offset</option>
          </select>
          {rtAnchor === 'clock' ? (
            <input
              type="time"
              value={rtClockTime}
              onChange={(e) => setRtClockTime(e.target.value)}
              className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          ) : (
            <input
              type="number"
              value={rtOffset}
              onChange={(e) => setRtOffset(Number(e.target.value))}
              placeholder="Offset mins (e.g. -60)"
              className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-base font-mono tabular-nums"
            />
          )}
          <select
            value={rtAppliesOn}
            onChange={(e) => setRtAppliesOn(e.target.value as RoutineAppliesOn)}
            className="min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="all">All Days</option>
            <option value="duty_days">Duty Days Only</option>
            <option value="off_days">Off Days Only</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (!rtTitle.trim()) return;
              createRoutine({
                title: rtTitle.trim(),
                block: rtBlock,
                anchorType: rtAnchor,
                clockTime: rtAnchor === 'clock' ? rtClockTime : null,
                anchorOffsetMin: rtOffset,
                appliesOn: rtAppliesOn,
                isMust: rtIsMust,
              });
              setRtTitle('');
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Routine
          </button>
        </div>
      </section>

      {/* 4. Reminders (Web Push Enable / Disable / Test + Simulator) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {STRINGS.reminders.title}
            </h2>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold font-mono ${
              pushStatus === 'enabled'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : pushStatus === 'denied'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {STRINGS.reminders.statusLabel}: {STRINGS.reminders.status[pushStatus]}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          {STRINGS.reminders.batteryHelp}
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={pushBusy || pushStatus === 'unsupported'}
            onClick={handleEnablePush}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-semibold"
          >
            {STRINGS.reminders.enableBtn}
          </button>
          <button
            type="button"
            disabled={pushBusy || pushStatus === 'unsupported'}
            onClick={handleDisablePush}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 disabled:opacity-50 text-xs font-semibold"
          >
            {STRINGS.reminders.disableBtn}
          </button>
          <button
            type="button"
            disabled={pushBusy || pushStatus !== 'enabled'}
            onClick={handleTestPush}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 disabled:opacity-50 text-white dark:text-slate-900 text-xs font-semibold"
          >
            {STRINGS.reminders.testBtn}
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Reminder Engine & Re-Entry Verification Tools
          </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => handleRunReminderTickTest(7 * 60)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold"
          >
            Test Morning Tick (07:00 AM)
          </button>
          <button
            type="button"
            onClick={() => handleRunReminderTickTest(11 * 60 + 15)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            Test Water Checkpoint (11:15 AM)
          </button>
          <button
            type="button"
            onClick={() => handleRunReminderTickTest(23 * 60 + 30)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            Test Quiet Hours (11:30 PM)
          </button>
          <button
            type="button"
            onClick={() => simulateGapDays(4)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-semibold"
          >
            Simulate 4-Day Gap (Re-entry Test)
          </button>
        </div>
        </div>

        {tickResult && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-2 font-mono tabular-nums">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Tick Result ({tickResult.todayDate} · {tickResult.nowMin} min):
            </p>
            <p>
              Quiet Hours Skipped: {String(tickResult.skippedQuietHours)} · Cap
              Reached: {String(tickResult.skippedCapReached)} · Due Items:{' '}
              {tickResult.dueCount}
            </p>
            {tickResult.digestNotification && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 font-sans space-y-1">
                <p className="font-semibold text-teal-800 dark:text-teal-300">
                  Digest Notification: {tickResult.digestNotification.title}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {tickResult.digestNotification.body}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Backup Export & Validated Restore (Section 16.2 & 16.3) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            JSON Backup Export & Restore
          </h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold font-mono ${
              state.settings.lastBackupAt
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
          >
            {state.settings.lastBackupAt
              ? `✓ Last Backup: ${state.settings.lastBackupAt.slice(0, 10)}`
              : '⚠ Backup Reminder: Mahine me 1 baar export karein'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Mahine me ek baar JSON export download karke 2 jagah (Phone + Drive) surakshit rakhein.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadExport}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON Backup
          </button>

          <label className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            Import & Merge JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => handleFileImport(e, 'merge')}
              className="hidden"
            />
          </label>

          <label className="min-h-[44px] px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            Import & Replace (Atomic Restore)
            <input
              type="file"
              accept="application/json"
              onChange={(e) => handleFileImport(e, 'replace-empty')}
              className="hidden"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
