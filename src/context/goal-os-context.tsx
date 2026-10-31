'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '@/src/lib/firebase';
import { AppStateData, DayPlan } from '@/src/lib/types';
import { createInitialSeedData } from '@/src/lib/seed-data';
import { todayLocal } from '@/src/lib/logic/dates';
import {
  coalesceOutboxOps,
  diffStatesToOps,
  mergeServerAndLocalState,
  SyncMutationOp,
  updateDeletedTombstones,
} from '@/src/lib/logic/sync';
import {
  GoalOsContextValue,
  NavTab,
  ToastMessage,
} from '@/src/context/types';
import { makeId } from '@/src/context/domain/helpers';
import { buildInboxActions } from '@/src/context/domain/inbox-actions';
import { buildGoalsActions } from '@/src/context/domain/goals-actions';
import { buildTasksActions } from '@/src/context/domain/tasks-actions';
import { buildRoutinesActions } from '@/src/context/domain/routines-actions';
import { buildReviewsSettingsActions } from '@/src/context/domain/reviews-settings-actions';
import {
  HAS_SYNCED_STORAGE_KEY,
  hydrateFromLocalStorage,
  LOCAL_STORAGE_KEY,
  OUTBOX_STORAGE_KEY,
  performFlushOutbox,
  TOMBSTONES_STORAGE_KEY,
} from '@/src/context/domain/sync-handlers';

export type { NavTab, ToastMessage, GoalOsContextValue };

const GoalOsContext = createContext<GoalOsContextValue | null>(null);

export function GoalOsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStateData>(() =>
    createInitialSeedData('local-user')
  );
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [pendingOutbox, setPendingOutbox] = useState<SyncMutationOp[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureInitialText, setQuickCaptureInitialText] = useState('');
  const [activeQualityGateGoalId, setActiveQualityGateGoalId] = useState<
    string | null
  >(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const openQuickCaptureWithPrefill = useCallback((prefillText: string) => {
    setQuickCaptureInitialText(prefillText);
    setQuickCaptureOpen(true);
  }, []);

  const idTokenRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const prevStateRef = useRef<AppStateData | null>(null);
  const skipNextDiffRef = useRef(false);
  const outboxRef = useRef<SyncMutationOp[]>([]);
  const tombstonesRef = useRef<Record<string, string>>({});
  const hasSyncedBeforeRef = useRef(false);
  const flushInFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushOutboxRef = useRef<() => Promise<void>>(async () => {});

  const persistOutbox = useCallback((nextOps: SyncMutationOp[]) => {
    outboxRef.current = nextOps;
    setPendingOutbox(nextOps);
    try {
      window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(nextOps));
    } catch {}
  }, []);

  const persistTombstones = useCallback(
    (nextTombs: Record<string, string>) => {
      tombstonesRef.current = nextTombs;
      try {
        window.localStorage.setItem(
          TOMBSTONES_STORAGE_KEY,
          JSON.stringify(nextTombs)
        );
      } catch {}
    },
    []
  );

  const showToast = useCallback(
    (
      text: string,
      type: ToastMessage['type'] = 'success',
      undoAction?: () => void
    ) => {
      const id = makeId('toast');
      setToasts((prev) => [...prev.slice(-2), { id, text, type, undoAction }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Hydrate cached state, outbox, tombstones & theme on mount
  useEffect(() => {
    queueMicrotask(() => {
      const { isDark, outbox, tombstones, hasSyncedBefore, hydratedState } =
        hydrateFromLocalStorage();

      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);

      outboxRef.current = outbox;
      setPendingOutbox(outbox);
      tombstonesRef.current = tombstones;
      hasSyncedBeforeRef.current = hasSyncedBefore;

      if (hydratedState) {
        prevStateRef.current = hydratedState;
        skipNextDiffRef.current = true;
        setState(hydratedState);
      } else {
        prevStateRef.current = state;
      }
      hydratedRef.current = true;
    });

    fetch('/api/ai/suggest')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.aiAvailable === 'boolean') {
          setAiAvailable(d.aiAvailable);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        window.localStorage.setItem('goalos_dark_mode', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Flush pending outbox ops to /api/mutate with retry & exponential backoff
  const flushOutbox = useCallback(async () => {
    if (!user || accessDenied) return;
    if (flushInFlightRef.current) return;
    if (outboxRef.current.length === 0) return;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    flushInFlightRef.current = true;
    try {
      const res = await performFlushOutbox({
        user,
        accessDenied,
        state,
        prevState: prevStateRef.current,
        outbox: outboxRef.current,
        idTokenRef,
        setAccessDenied,
        setCloudSynced,
        persistOutbox,
        setState,
        skipNextDiffRef,
        prevStateRef,
        hasSyncedBeforeRef,
        showToast,
      });

      retryCountRef.current = 0;
      if (res.remainingOutbox.length > 0) {
        retryTimerRef.current = setTimeout(() => {
          flushInFlightRef.current = false;
          void flushOutboxRef.current();
        }, 150);
      }
    } catch {
      setCloudSynced(false);
      const delayMs = Math.min(30_000, 1000 * Math.pow(2, retryCountRef.current));
      retryCountRef.current = Math.min(retryCountRef.current + 1, 6);
      retryTimerRef.current = setTimeout(() => {
        void flushOutboxRef.current();
      }, delayMs);
    } finally {
      flushInFlightRef.current = false;
    }
  }, [user, accessDenied, state, persistOutbox, showToast]);

  // Keep flushOutboxRef in sync via effect
  useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

  // Flush outbox when browser reconnects online
  useEffect(() => {
    const handleOnline = () => {
      retryCountRef.current = 0;
      void flushOutbox();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [flushOutbox]);

  // Firebase Auth listener + Cloud SQL state fetch on login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        idTokenRef.current = null;
        setAccessDenied(false);
        setCloudSynced(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        idTokenRef.current = token;
        const res = await fetch('/api/state', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) {
          setAccessDenied(true);
          setCloudSynced(false);
          return;
        }
        setAccessDenied(false);
        if (res.ok) {
          const data = await res.json();
          if (data.state) {
            const localSnap = prevStateRef.current || state;
            const merged = mergeServerAndLocalState({
              localState: localSnap,
              serverState: data.state as AppStateData,
              pendingOutbox: outboxRef.current,
              deletedTombstones: tombstonesRef.current,
              hasSyncedBefore: hasSyncedBeforeRef.current,
              nowIso: new Date().toISOString(),
            });

            skipNextDiffRef.current = true;
            prevStateRef.current = merged.mergedState;
            setState(merged.mergedState);
            persistOutbox(merged.opsToFlush);
            hasSyncedBeforeRef.current = true;
            setCloudSynced(true);

            try {
              window.localStorage.setItem(HAS_SYNCED_STORAGE_KEY, 'true');
              window.localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify(merged.mergedState)
              );
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Cloud SQL fetch fallback to local cache:', err);
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistOutbox]);

  // Persist state changes to localStorage and record incremental outbox ops
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch {}

    if (skipNextDiffRef.current) {
      skipNextDiffRef.current = false;
      prevStateRef.current = state;
      if (user && !accessDenied && outboxRef.current.length > 0) {
        const timer = setTimeout(() => {
          void flushOutbox();
        }, 250);
        return () => clearTimeout(timer);
      }
      return;
    }

    if (prevStateRef.current) {
      const nowIso = new Date().toISOString();
      const newOps = diffStatesToOps(prevStateRef.current, state, nowIso);
      prevStateRef.current = state;
      if (newOps.length > 0) {
        const coalesced = coalesceOutboxOps(outboxRef.current, newOps);
        persistOutbox(coalesced);
        const nextTombs = updateDeletedTombstones(tombstonesRef.current, newOps);
        persistTombstones(nextTombs);
      }
    } else {
      prevStateRef.current = state;
    }

    if (!user || accessDenied || outboxRef.current.length === 0) return;
    const timer = setTimeout(() => {
      void flushOutbox();
    }, 450);

    return () => clearTimeout(timer);
  }, [
    state,
    user,
    accessDenied,
    flushOutbox,
    persistOutbox,
    persistTombstones,
  ]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      showToast('Google Account aur Cloud SQL sync jud gaya!', 'success');
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Google Sign-In cancel hua.';
      showToast(msg, 'warning');
    }
  }, [showToast]);

  const logoutUser = useCallback(async () => {
    await signOut(auth);
    idTokenRef.current = null;
    setAccessDenied(false);
    setCloudSynced(false);
    showToast('Signed out (Local offline mode active).', 'info');
  }, [showToast]);

  const today = useMemo(() => {
    return todayLocal(
      state.settings.timezone || 'Asia/Kolkata',
      state.settings.dayRolloverHour ?? 4
    );
  }, [state.settings.timezone, state.settings.dayRolloverHour]);

  const todayPlan = useMemo<DayPlan>(() => {
    const found = state.dayPlans.find((dp) => dp.planDate === today);
    if (found) return found;
    return {
      id: `${state.settings.userId}_${today}`,
      userId: state.settings.userId,
      planDate: today,
      isOff: false,
      dutyStart: '08:30',
      minimumDay: false,
      mainTaskId: null,
      locked: false,
    };
  }, [state.dayPlans, state.settings.userId, today]);

  // Compose modular domain actions
  const inboxActions = useMemo(
    () =>
      buildInboxActions({
        state,
        setState,
        today,
        showToast,
        setActiveQualityGateGoalId,
      }),
    [state, today, showToast]
  );

  const goalsActions = useMemo(
    () =>
      buildGoalsActions({
        state,
        setState,
        today,
        showToast,
        setActiveQualityGateGoalId,
      }),
    [state, today, showToast]
  );

  const tasksActions = useMemo(
    () =>
      buildTasksActions({
        state,
        setState,
        today,
        showToast,
      }),
    [state, today, showToast]
  );

  const routinesActions = useMemo(
    () =>
      buildRoutinesActions({
        state,
        setState,
        today,
        showToast,
      }),
    [state, today, showToast]
  );

  const reviewsSettingsActions = useMemo(
    () =>
      buildReviewsSettingsActions({
        state,
        setState,
        today,
        user,
        accessDenied,
        showToast,
        setAiAvailable,
      }),
    [state, today, user, accessDenied, showToast]
  );

  const importBackupJson = useCallback(
    (rawJson: unknown, mode: 'merge' | 'replace-empty') => {
      return reviewsSettingsActions.importBackupJson(
        rawJson,
        mode,
        (tables) => {
          skipNextDiffRef.current = true;
          prevStateRef.current = tables;
          persistOutbox([]);
        }
      );
    },
    [reviewsSettingsActions, persistOutbox]
  );

  const value = useMemo<GoalOsContextValue>(
    () => ({
      state,
      today,
      activeTab,
      setActiveTab,
      user,
      authLoading,
      accessDenied,
      cloudSynced,
      pendingSyncCount: pendingOutbox.length,
      aiAvailable,
      darkMode,
      toggleDarkMode,
      toasts,
      showToast,
      dismissToast,
      signInWithGoogle,
      logoutUser,
      quickCaptureOpen,
      setQuickCaptureOpen,
      quickCaptureInitialText,
      setQuickCaptureInitialText,
      openQuickCaptureWithPrefill,
      activeQualityGateGoalId,
      setActiveQualityGateGoalId,
      todayPlan,
      // Inbox domain
      ...inboxActions,
      // Goals domain
      ...goalsActions,
      // Tasks domain
      ...tasksActions,
      // Routines & Water domain
      ...routinesActions,
      // Reviews, Settings & AI domain
      ...reviewsSettingsActions,
      importBackupJson,
    }),
    [
      state,
      today,
      activeTab,
      user,
      authLoading,
      accessDenied,
      cloudSynced,
      pendingOutbox.length,
      aiAvailable,
      darkMode,
      toggleDarkMode,
      toasts,
      showToast,
      dismissToast,
      signInWithGoogle,
      logoutUser,
      quickCaptureOpen,
      quickCaptureInitialText,
      openQuickCaptureWithPrefill,
      activeQualityGateGoalId,
      todayPlan,
      inboxActions,
      goalsActions,
      tasksActions,
      routinesActions,
      reviewsSettingsActions,
      importBackupJson,
    ]
  );

  return (
    <GoalOsContext.Provider value={value}>{children}</GoalOsContext.Provider>
  );
}

export function useGoalOs(): GoalOsContextValue {
  const ctx = useContext(GoalOsContext);
  if (!ctx) {
    throw new Error('useGoalOs must be used within a GoalOsProvider');
  }
  return ctx;
}
