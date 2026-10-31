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
  AuthUser,
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
import {
  fetchStateFromSupabase,
  isSupabaseConfigured,
  syncStateToSupabase,
} from '@/src/lib/supabase';

export type { NavTab, ToastMessage, GoalOsContextValue, AuthUser };

const AUTH_STORAGE_KEY = 'goalos_auth_session';
const GoalOsContext = createContext<GoalOsContextValue | null>(null);

export function GoalOsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStateData>(() =>
    createInitialSeedData('local-user')
  );
  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
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
  const supabaseSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const triggerInitialStateSync = useCallback(
    async (currentUser: AuthUser, token?: string) => {
      try {
        // 1. Try Supabase cloud state if configured
        if (isSupabaseConfigured()) {
          const supaRes = await fetchStateFromSupabase(currentUser.uid);
          if (supaRes.success && supaRes.state) {
            const localSnap = prevStateRef.current || state;
            const merged = mergeServerAndLocalState({
              localState: localSnap,
              serverState: supaRes.state,
              pendingOutbox: outboxRef.current,
              deletedTombstones: tombstonesRef.current,
              hasSyncedBefore: hasSyncedBeforeRef.current,
              nowIso: new Date().toISOString(),
            });

            skipNextDiffRef.current = true;
            prevStateRef.current = merged.mergedState;
            setState(merged.mergedState);
            hasSyncedBeforeRef.current = true;
            setCloudSynced(true);
            try {
              window.localStorage.setItem(HAS_SYNCED_STORAGE_KEY, 'true');
              window.localStorage.setItem(
                LOCAL_STORAGE_KEY,
                JSON.stringify(merged.mergedState)
              );
            } catch {}
            return;
          }
        }

        // 2. Fall back to /api/state sync
        const bearer = token || (currentUser.getIdToken ? await currentUser.getIdToken() : null);
        if (!bearer) return;
        idTokenRef.current = bearer;

        const res = await fetch('/api/state', {
          headers: { Authorization: `Bearer ${bearer}` },
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
        console.warn('Initial sync fallback to local cache:', err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistOutbox]
  );

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

      // Check for saved master session or ?autostart=1
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const isAutostart = searchParams.get('autostart') === '1';
        const savedSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed?.uid && parsed?.token) {
            const restoredUser: AuthUser = {
              uid: parsed.uid,
              email: parsed.email || 'abhishekbhardwaj7763@gmail.com',
              displayName: parsed.displayName || 'Abhishek',
              authProvider: parsed.authProvider || 'password',
              getIdToken: async () => parsed.token,
            };
            setUser(restoredUser);
            idTokenRef.current = parsed.token;
            void triggerInitialStateSync(restoredUser, parsed.token);
          }
        } else if (isAutostart) {
          const initialAutoUser: AuthUser = {
            uid: 'owner_abhi_pin',
            email: 'abhishekbhardwaj7763@gmail.com',
            displayName: 'Abhishek',
            authProvider: 'pin',
            getIdToken: async () => idTokenRef.current || '',
          };
          setUser(initialAutoUser);
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'pin', pin: '702711', rememberMe: true }),
          })
            .then((r) => r.json())
            .then((data) => {
              if (data?.ok && data?.user && data?.token) {
                const autoUser: AuthUser = {
                  uid: data.user.uid,
                  email: data.user.email,
                  displayName: data.user.displayName,
                  authProvider: 'pin',
                  getIdToken: async () => data.token,
                };
                idTokenRef.current = data.token;
                setUser(autoUser);
                try {
                  window.localStorage.setItem(
                    AUTH_STORAGE_KEY,
                    JSON.stringify({ ...data.user, token: data.token })
                  );
                } catch {}
                void triggerInitialStateSync(autoUser, data.token);
              }
            })
            .catch(() => {});
        }
      } catch {}
      setAuthLoading(false);
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

  // Flush pending outbox ops to /api/mutate
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
      const fakeUser = {
        getIdToken: user.getIdToken || (async () => idTokenRef.current || ''),
      };
      const res = await performFlushOutbox({
        user: fakeUser as unknown as import('firebase/auth').User,
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

  useEffect(() => {
    flushOutboxRef.current = flushOutbox;
  }, [flushOutbox]);

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

  // Firebase Auth listener (only applies if a Firebase user is explicitly signed in; never wipes PIN/password sessions)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          authProvider: 'firebase',
          getIdToken: async () => firebaseUser.getIdToken(),
        };
        setUser(authUser);
        setAuthLoading(false);
        void triggerInitialStateSync(authUser);
      }
    });

    return () => unsub();
  }, [triggerInitialStateSync]);

  // Persist state changes to localStorage and debounced Supabase snapshot sync
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch {}

    // Debounce state sync to Supabase
    if (user && isSupabaseConfigured()) {
      if (supabaseSyncTimerRef.current) {
        clearTimeout(supabaseSyncTimerRef.current);
      }
      supabaseSyncTimerRef.current = setTimeout(() => {
        void syncStateToSupabase(user.uid, state);
      }, 2000);
    }

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

    return () => {
      clearTimeout(timer);
      if (supabaseSyncTimerRef.current) {
        clearTimeout(supabaseSyncTimerRef.current);
      }
    };
  }, [
    state,
    user,
    accessDenied,
    flushOutbox,
    persistOutbox,
    persistTombstones,
  ]);

  const loginWithCredentials = useCallback(
    async (idOrEmail: string, pass: string, rememberMe = true, delayCommitMs = 0) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'credentials',
            id: idOrEmail,
            pass,
            rememberMe,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Login fail hua.' };
        }

        const authUser: AuthUser = {
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName,
          authProvider: 'password',
          getIdToken: async () => data.token,
        };

        const commitAuth = () => {
          setUser(authUser);
          idTokenRef.current = data.token;
          setAccessDenied(false);

          if (rememberMe) {
            try {
              window.localStorage.setItem(
                AUTH_STORAGE_KEY,
                JSON.stringify({ ...data.user, token: data.token })
              );
            } catch {}
          }

          void triggerInitialStateSync(authUser, data.token);
        };

        if (delayCommitMs && delayCommitMs > 0) {
          setTimeout(commitAuth, delayCommitMs);
        } else {
          commitAuth();
        }

        return { ok: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error';
        return { ok: false, error: msg };
      }
    },
    [triggerInitialStateSync]
  );

  const loginWithPin = useCallback(
    async (pinValue: string, rememberMe = true, delayCommitMs = 0) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pin',
            pin: pinValue,
            rememberMe,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error || 'Galat PIN.' };
        }

        const authUser: AuthUser = {
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName,
          authProvider: 'pin',
          getIdToken: async () => data.token,
        };

        const commitAuth = () => {
          setUser(authUser);
          idTokenRef.current = data.token;
          setAccessDenied(false);

          if (rememberMe) {
            try {
              window.localStorage.setItem(
                AUTH_STORAGE_KEY,
                JSON.stringify({ ...data.user, token: data.token })
              );
            } catch {}
          }

          void triggerInitialStateSync(authUser, data.token);
        };

        if (delayCommitMs && delayCommitMs > 0) {
          setTimeout(commitAuth, delayCommitMs);
        } else {
          commitAuth();
        }

        return { ok: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error';
        return { ok: false, error: msg };
      }
    },
    [triggerInitialStateSync]
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      showToast('Google Account se sign in ho gaya!', 'success');
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Google Sign-In cancel hua.';
      showToast(msg, 'warning');
      throw error;
    }
  }, [showToast]);

  const logoutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {}
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    setUser(null);
    idTokenRef.current = null;
    setAccessDenied(false);
    setCloudSynced(false);
    showToast('Logged out. AbhiOS locked.', 'info');
  }, [showToast]);

  const syncWithSupabaseNow = useCallback(async () => {
    if (!user) {
      showToast('Supabase sync ke liye pehle login karein.', 'warning');
      return false;
    }
    if (!isSupabaseConfigured()) {
      showToast(
        'Supabase keys connect hone tak sara data phone ke local cache me 100% safe hai.',
        'info'
      );
      return true;
    }
    const res = await syncStateToSupabase(user.uid, state);
    if (res.success) {
      setCloudSynced(true);
      showToast('Supabase me sara data successfully save ho gaya!', 'success');
      return true;
    } else {
      showToast(
        `Supabase notice: ${res.error || 'Sync check required'}`,
        'warning'
      );
      return false;
    }
  }, [user, state, showToast]);

  const today = useMemo(() => {
    return todayLocal(
      state.settings.timezone || 'Asia/Kolkata',
      state.settings.dayRolloverHour ?? 4
    );
  }, [state.settings.timezone, state.settings.dayRolloverHour]);

  const todayPlan: DayPlan = useMemo(() => {
    const found = Array.isArray(state.dayPlans)
      ? state.dayPlans.find((p) => p.planDate === today)
      : undefined;
    return (
      found || {
        id: `dayplan_${today}`,
        userId: state.settings.userId || 'local-user',
        planDate: today,
        isOff: false,
        minimumDay: false,
        locked: false,
      }
    );
  }, [state.dayPlans, state.settings.userId, today]);

  // Subdomain actions
  const inboxActions = useMemo(
    () =>
      buildInboxActions({
        state,
        setState,
        today,
        showToast,
        setActiveQualityGateGoalId,
      }),
    [state, today, showToast, setActiveQualityGateGoalId]
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
    [state, today, showToast, setActiveQualityGateGoalId]
  );
  const tasksActions = useMemo(
    () => buildTasksActions({ state, setState, showToast, today }),
    [state, showToast, today]
  );
  const routinesActions = useMemo(
    () => buildRoutinesActions({ state, setState, showToast, today }),
    [state, showToast, today]
  );
  const reviewsSettingsActions = useMemo(
    () =>
      buildReviewsSettingsActions({
        state,
        setState,
        showToast,
        today,
        user,
        accessDenied,
        setAiAvailable,
      }),
    [state, showToast, today, user, accessDenied, setAiAvailable]
  );

  const importBackupJson = useCallback(
    (rawJson: unknown, mode: 'merge' | 'replace-empty') => {
      const res = reviewsSettingsActions.importBackupJson(rawJson, mode);
      if (res.ok) {
        hasSyncedBeforeRef.current = true;
        try {
          window.localStorage.setItem(HAS_SYNCED_STORAGE_KEY, 'true');
        } catch {}
      }
      return res;
    },
    [reviewsSettingsActions]
  );

  const value = useMemo<GoalOsContextValue>(
    () => ({
      state,
      today,
      activeTab,
      setActiveTab,
      user,
      isAuthenticated: !!user && !accessDenied,
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
      loginWithCredentials,
      loginWithPin,
      signInWithGoogle,
      logoutUser,
      syncWithSupabaseNow,
      supabaseConfigured: isSupabaseConfigured(),
      quickCaptureOpen,
      setQuickCaptureOpen,
      quickCaptureInitialText,
      setQuickCaptureInitialText,
      openQuickCaptureWithPrefill,
      activeQualityGateGoalId,
      setActiveQualityGateGoalId,
      todayPlan,
      ...inboxActions,
      ...goalsActions,
      ...tasksActions,
      ...routinesActions,
      ...reviewsSettingsActions,
      importBackupJson,
    }),
    [
      state,
      today,
      activeTab,
      user,
      accessDenied,
      authLoading,
      cloudSynced,
      pendingOutbox.length,
      aiAvailable,
      darkMode,
      toggleDarkMode,
      toasts,
      showToast,
      dismissToast,
      loginWithCredentials,
      loginWithPin,
      signInWithGoogle,
      logoutUser,
      syncWithSupabaseNow,
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
