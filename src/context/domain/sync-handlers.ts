import { User } from 'firebase/auth';
import { AppStateData } from '@/src/lib/types';
import { createInitialSeedData } from '@/src/lib/seed-data';
import {
  MAX_MUTATE_OPS,
  MutationOpResult,
  resolveMutationResults,
  SyncMutationOp,
} from '@/src/lib/logic/sync';
import { STRINGS } from '@/src/lib/strings';
import { ToastMessage } from '@/src/context/types';

export const LOCAL_STORAGE_KEY = 'goalos_v2_state_cache';
export const OUTBOX_STORAGE_KEY = 'goalos_sync_outbox_v2';
export const TOMBSTONES_STORAGE_KEY = 'goalos_deleted_tombstones_v2';
export const HAS_SYNCED_STORAGE_KEY = 'goalos_has_synced_v2';

export interface HydrateStorageResult {
  isDark: boolean;
  outbox: SyncMutationOp[];
  tombstones: Record<string, string>;
  hasSyncedBefore: boolean;
  hydratedState: AppStateData | null;
}

export function hydrateFromLocalStorage(): HydrateStorageResult {
  let isDark = false;
  let outbox: SyncMutationOp[] = [];
  let tombstones: Record<string, string> = {};
  let hasSyncedBefore = false;
  let hydratedState: AppStateData | null = null;

  try {
    const savedTheme = window.localStorage.getItem('goalos_dark_mode');
    isDark = savedTheme === 'true';

    const rawOutbox = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (rawOutbox) {
      const parsedOutbox = JSON.parse(rawOutbox);
      if (Array.isArray(parsedOutbox)) {
        outbox = parsedOutbox as SyncMutationOp[];
      }
    }

    const rawTombs = window.localStorage.getItem(TOMBSTONES_STORAGE_KEY);
    if (rawTombs) {
      const parsedTombs = JSON.parse(rawTombs);
      if (
        parsedTombs &&
        typeof parsedTombs === 'object' &&
        !Array.isArray(parsedTombs)
      ) {
        tombstones = parsedTombs as Record<string, string>;
      }
    }

    hasSyncedBefore =
      window.localStorage.getItem(HAS_SYNCED_STORAGE_KEY) === 'true';

    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppStateData;
      if (parsed && Array.isArray(parsed.inboxItems)) {
        // Faithful preservation: If user has saved state, preserve exactly what was saved
        const seed = createInitialSeedData(
          parsed.settings?.userId || 'local-user'
        );
        const userAreas =
          parsed.lifeAreas && parsed.lifeAreas.length > 0
            ? parsed.lifeAreas
            : seed.lifeAreas;

        hydratedState = {
          ...parsed,
          lifeAreas: userAreas,
          inboxItems: parsed.inboxItems || [],
          goals: parsed.goals || [],
          tasks: parsed.tasks || [],
          routines: parsed.routines || [],
          milestones: parsed.milestones || [],
          projects: parsed.projects || [],
          dayPlans: Array.isArray(parsed.dayPlans) ? parsed.dayPlans : [],
          dailyReviews: Array.isArray(parsed.dailyReviews) ? parsed.dailyReviews : [],
          weeklyReviews: Array.isArray(parsed.weeklyReviews) ? parsed.weeklyReviews : [],
          routineLogs: Array.isArray(parsed.routineLogs) ? parsed.routineLogs : [],
        };
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return {
    isDark,
    outbox,
    tombstones,
    hasSyncedBefore,
    hydratedState,
  };
}

export interface FlushOutboxParams {
  user: User;
  accessDenied: boolean;
  state: AppStateData;
  prevState: AppStateData | null;
  outbox: SyncMutationOp[];
  idTokenRef: React.MutableRefObject<string | null>;
  setAccessDenied: (denied: boolean) => void;
  setCloudSynced: (synced: boolean) => void;
  persistOutbox: (ops: SyncMutationOp[]) => void;
  setState: React.Dispatch<React.SetStateAction<AppStateData>>;
  skipNextDiffRef: React.MutableRefObject<boolean>;
  prevStateRef: React.MutableRefObject<AppStateData | null>;
  hasSyncedBeforeRef: React.MutableRefObject<boolean>;
  showToast: (
    text: string,
    type?: ToastMessage['type'],
    undoAction?: () => void
  ) => void;
}

export async function performFlushOutbox({
  user,
  accessDenied,
  state,
  prevState,
  outbox,
  idTokenRef,
  setAccessDenied,
  setCloudSynced,
  persistOutbox,
  setState,
  skipNextDiffRef,
  prevStateRef,
  hasSyncedBeforeRef,
  showToast,
}: FlushOutboxParams): Promise<{
  success: boolean;
  remainingOutbox: SyncMutationOp[];
}> {
  if (accessDenied || outbox.length === 0) {
    return { success: true, remainingOutbox: outbox };
  }

  const token = await user.getIdToken();
  idTokenRef.current = token;

  if (process.env.NEXT_PUBLIC_LEGACY_FULL_STATE_SYNC === 'true') {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'sync',
        state: prevState || state,
      }),
    });
    if (res.status === 403) {
      setAccessDenied(true);
      setCloudSynced(false);
      return { success: false, remainingOutbox: outbox };
    }
    if (res.ok) {
      persistOutbox([]);
      setCloudSynced(true);
      return { success: true, remainingOutbox: [] };
    }
    throw new Error(`Legacy sync failed with ${res.status}`);
  }

  const batch = outbox.slice(0, MAX_MUTATE_OPS);
  const res = await fetch('/api/mutate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ops: batch }),
  });

  if (res.status === 403) {
    setAccessDenied(true);
    setCloudSynced(false);
    return { success: false, remainingOutbox: outbox };
  }

  if (!res.ok) {
    throw new Error(`Mutate failed with status ${res.status}`);
  }

  const data = (await res.json()) as {
    ok: boolean;
    results?: MutationOpResult[];
  };
  const results = Array.isArray(data.results) ? data.results : [];

  const currentSnap = prevState || state;
  const resolution = resolveMutationResults({
    currentState: currentSnap,
    pendingOutbox: outbox,
    sentOps: batch,
    results,
  });

  persistOutbox(resolution.remainingOutbox);
  hasSyncedBeforeRef.current = true;
  try {
    window.localStorage.setItem(HAS_SYNCED_STORAGE_KEY, 'true');
  } catch {}
  setCloudSynced(true);

  if (resolution.conflictCount > 0) {
    skipNextDiffRef.current = true;
    prevStateRef.current = resolution.nextState;
    setState(resolution.nextState);
    try {
      window.localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(resolution.nextState)
      );
    } catch {}
    showToast(STRINGS.sync.conflictToast, 'info');
  } else {
    prevStateRef.current = resolution.nextState;
  }

  return {
    success: true,
    remainingOutbox: resolution.remainingOutbox,
  };
}
