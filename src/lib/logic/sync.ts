import { AppStateData } from '../types';

export const SYNC_ENTITIES = [
  'settings',
  'lifeAreas',
  'inboxItems',
  'inboxLinks',
  'goals',
  'projects',
  'milestones',
  'tasks',
  'dayPlans',
  'routines',
  'routineLogs',
  'dailyReviews',
  'weeklyReviews',
] as const;

export type SyncEntityName = (typeof SYNC_ENTITIES)[number];

export type CollectionSyncEntityName = Exclude<SyncEntityName, 'settings'>;

export const COLLECTION_SYNC_ENTITIES: readonly CollectionSyncEntityName[] = [
  'lifeAreas',
  'inboxItems',
  'inboxLinks',
  'goals',
  'projects',
  'milestones',
  'tasks',
  'dayPlans',
  'routines',
  'routineLogs',
  'dailyReviews',
  'weeklyReviews',
] as const;

export const MAX_MUTATION_OPS = 200;
export const MAX_MUTATE_OPS = MAX_MUTATION_OPS;

export interface MutationOp {
  op: 'upsert' | 'delete';
  entity: SyncEntityName;
  id: string;
  data?: Record<string, unknown>;
  baseUpdatedAt?: string;
  queuedAt: string;
}

export type SyncMutationOp = MutationOp;

export type MutationOpResult =
  | {
      id: string;
      entity: SyncEntityName;
      op: 'upsert' | 'delete';
      ok: true;
      conflict?: false;
      updatedAt: string;
    }
  | {
      id: string;
      entity: SyncEntityName;
      op: 'upsert';
      ok: false;
      conflict: true;
      serverRow: Record<string, unknown>;
      updatedAt?: string;
    };

export function parseIsoMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}

export function getEntityUpdatedAt(item: unknown): string | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const rec = item as Record<string, unknown>;
  if (typeof rec.updatedAt === 'string' && rec.updatedAt.trim()) {
    return rec.updatedAt;
  }
  if (typeof rec.createdAt === 'string' && rec.createdAt.trim()) {
    return rec.createdAt;
  }
  return undefined;
}

/**
 * Pure helper used on the server inside db.transaction:
 * Returns true if the client's baseUpdatedAt is older than the server row's updated_at.
 */
export function isConflictStale(
  baseUpdatedAt: string | undefined,
  serverUpdatedAt: Date | string | null | undefined
): boolean {
  if (!baseUpdatedAt) return false;
  const baseMs = parseIsoMs(baseUpdatedAt);
  const serverMs = parseIsoMs(serverUpdatedAt);
  if (baseMs <= 0 || serverMs <= 0) return false;
  // Allow 1ms tolerance for ISO serialization rounding
  return baseMs + 1 < serverMs;
}

function stableComparableJson(item: unknown): string {
  if (!item || typeof item !== 'object') return JSON.stringify(item);
  const rec = { ...(item as Record<string, unknown>) };
  // Ignore userId differences when comparing local-user vs authenticated uid
  delete rec.userId;
  return JSON.stringify(rec);
}

/**
 * Computes incremental MutationOps by diffing prevState vs nextState across all entities.
 */
export function diffStatesToOps(
  prevState: AppStateData,
  nextState: AppStateData,
  nowIso: string = new Date().toISOString()
): MutationOp[] {
  const ops: MutationOp[] = [];

  if (
    stableComparableJson(prevState.settings) !==
    stableComparableJson(nextState.settings)
  ) {
    const settingsId = nextState.settings.userId || 'settings';
    ops.push({
      op: 'upsert',
      entity: 'settings',
      id: settingsId,
      data: { ...(nextState.settings as unknown as Record<string, unknown>) },
      baseUpdatedAt: getEntityUpdatedAt(prevState.settings),
      queuedAt: nowIso,
    });
  }

  for (const entity of COLLECTION_SYNC_ENTITIES) {
    const prevList = (prevState[entity] || []) as unknown as Array<
      Record<string, unknown> & { id: string }
    >;
    const nextList = (nextState[entity] || []) as unknown as Array<
      Record<string, unknown> & { id: string }
    >;

    const prevMap = new Map<string, Record<string, unknown> & { id: string }>();
    for (const item of prevList) {
      if (item && typeof item.id === 'string') {
        prevMap.set(item.id, item);
      }
    }

    const nextMap = new Map<string, Record<string, unknown> & { id: string }>();
    for (const item of nextList) {
      if (item && typeof item.id === 'string') {
        nextMap.set(item.id, item);
      }
    }

    // 1. Upserts (new or modified)
    for (const [id, nextItem] of nextMap.entries()) {
      const prevItem = prevMap.get(id);
      if (!prevItem) {
        ops.push({
          op: 'upsert',
          entity,
          id,
          data: { ...nextItem },
          queuedAt: nowIso,
        });
      } else if (
        stableComparableJson(prevItem) !== stableComparableJson(nextItem)
      ) {
        ops.push({
          op: 'upsert',
          entity,
          id,
          data: { ...nextItem },
          baseUpdatedAt: getEntityUpdatedAt(prevItem),
          queuedAt: nowIso,
        });
      }
    }

    // 2. Deletes (present in prevState, removed in nextState)
    for (const [id, prevItem] of prevMap.entries()) {
      if (!nextMap.has(id)) {
        ops.push({
          op: 'delete',
          entity,
          id,
          baseUpdatedAt: getEntityUpdatedAt(prevItem),
          queuedAt: nowIso,
        });
      }
    }
  }

  return ops;
}

/**
 * Coalesces/deduplicates pending outbox ops by (entity, id) while preserving the original
 * baseUpdatedAt from the first local modification after the last server sync.
 */
export function coalesceOutboxOps(
  existingOutbox: MutationOp[],
  incomingOps: MutationOp[]
): MutationOp[] {
  const map = new Map<string, MutationOp>();

  for (const op of existingOutbox) {
    const key = `${op.entity}:${op.id}`;
    map.set(key, { ...op });
  }

  for (const incoming of incomingOps) {
    const key = `${incoming.entity}:${incoming.id}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...incoming });
      continue;
    }

    if (existing.op === 'upsert' && incoming.op === 'upsert') {
      map.set(key, {
        op: 'upsert',
        entity: incoming.entity,
        id: incoming.id,
        data: incoming.data,
        baseUpdatedAt: existing.baseUpdatedAt ?? incoming.baseUpdatedAt,
        queuedAt: incoming.queuedAt,
      });
    } else if (existing.op === 'upsert' && incoming.op === 'delete') {
      map.set(key, {
        op: 'delete',
        entity: incoming.entity,
        id: incoming.id,
        baseUpdatedAt: existing.baseUpdatedAt ?? incoming.baseUpdatedAt,
        queuedAt: incoming.queuedAt,
      });
    } else if (existing.op === 'delete' && incoming.op === 'upsert') {
      map.set(key, {
        op: 'upsert',
        entity: incoming.entity,
        id: incoming.id,
        data: incoming.data,
        baseUpdatedAt: existing.baseUpdatedAt ?? incoming.baseUpdatedAt,
        queuedAt: incoming.queuedAt,
      });
    } else {
      // delete -> delete
      map.set(key, {
        ...existing,
        queuedAt: incoming.queuedAt,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Updates the local deleted tombstones map from emitted ops.
 */
export function updateDeletedTombstones(
  existingTombstones: Record<string, string>,
  ops: MutationOp[]
): Record<string, string> {
  const next = { ...existingTombstones };
  for (const op of ops) {
    const key = `${op.entity}:${op.id}`;
    if (op.op === 'delete') {
      next[key] = op.queuedAt;
    } else if (op.op === 'upsert') {
      delete next[key];
    }
  }
  return next;
}

/**
 * Pure merge on login / state fetch:
 * - Server wins per entity when server.updatedAt >= local.updatedAt, UNLESS the entity has
 *   a pending op in the outbox (then keep local and re-send).
 * - Never drops pending local changes.
 * - Never resurrects deleted goals/entities (respects pending 'delete' ops, tombstones, and
 *   server deletions when hasSyncedBefore is true).
 */
export function mergeServerAndLocalState(params: {
  localState: AppStateData;
  serverState: AppStateData;
  pendingOutbox: MutationOp[];
  deletedTombstones?: Record<string, string>;
  hasSyncedBefore?: boolean;
  nowIso?: string;
}): {
  mergedState: AppStateData;
  opsToFlush: MutationOp[];
} {
  const {
    localState,
    serverState,
    pendingOutbox,
    deletedTombstones = {},
    hasSyncedBefore = true,
    nowIso = new Date().toISOString(),
  } = params;

  const pendingByKey = new Map<string, MutationOp>();
  for (const op of pendingOutbox) {
    pendingByKey.set(`${op.entity}:${op.id}`, op);
  }

  let additionalOps: MutationOp[] = [];

  // 1. Merge settings
  let mergedSettings = { ...serverState.settings };
  const pendingSettingsOp =
    pendingByKey.get(`settings:${localState.settings.userId}`) ||
    pendingByKey.get('settings:settings') ||
    pendingOutbox.find((o) => o.entity === 'settings');

  if (pendingSettingsOp && pendingSettingsOp.op === 'upsert') {
    mergedSettings = {
      ...serverState.settings,
      ...localState.settings,
      userId: serverState.settings.userId,
    };
  } else {
    const localSettingsMs = parseIsoMs(getEntityUpdatedAt(localState.settings));
    const serverSettingsMs = parseIsoMs(
      getEntityUpdatedAt(serverState.settings)
    );
    if (localSettingsMs > serverSettingsMs && serverSettingsMs > 0) {
      mergedSettings = {
        ...serverState.settings,
        ...localState.settings,
        userId: serverState.settings.userId,
      };
      additionalOps.push({
        op: 'upsert',
        entity: 'settings',
        id: serverState.settings.userId,
        data: mergedSettings as unknown as Record<string, unknown>,
        baseUpdatedAt: getEntityUpdatedAt(serverState.settings),
        queuedAt: nowIso,
      });
    }
  }

  const mergedCollections: Partial<
    Record<CollectionSyncEntityName, Array<Record<string, unknown>>>
  > = {};

  for (const entity of COLLECTION_SYNC_ENTITIES) {
    const localList = (localState[entity] || []) as unknown as Array<
      Record<string, unknown> & { id: string }
    >;
    const serverList = (serverState[entity] || []) as unknown as Array<
      Record<string, unknown> & { id: string }
    >;

    const localMap = new Map<string, Record<string, unknown> & { id: string }>();
    for (const item of localList) {
      if (item && typeof item.id === 'string') {
        localMap.set(item.id, item);
      }
    }

    const serverMap = new Map<string, Record<string, unknown> & { id: string }>();
    for (const item of serverList) {
      if (item && typeof item.id === 'string') {
        serverMap.set(item.id, item);
      }
    }

    const allIds = new Set<string>([
      ...serverMap.keys(),
      ...localMap.keys(),
    ]);
    for (const op of pendingOutbox) {
      if (op.entity === entity) {
        allIds.add(op.id);
      }
    }

    const resultList: Array<Record<string, unknown>> = [];

    for (const id of allIds) {
      const key = `${entity}:${id}`;
      const pendingOp = pendingByKey.get(key);
      const localItem = localMap.get(id);
      const serverItem = serverMap.get(id);
      const tombstoneAt = deletedTombstones[key];

      // 1. Pending delete in outbox -> never resurrect
      if (pendingOp && pendingOp.op === 'delete') {
        continue;
      }

      // 2. Pending upsert in outbox -> keep local item and keep op in outbox
      if (pendingOp && pendingOp.op === 'upsert') {
        const chosen = localItem || (pendingOp.data as Record<string, unknown>);
        if (chosen) {
          resultList.push({
            ...chosen,
            userId: serverState.settings.userId,
          });
        }
        continue;
      }

      // 3. Tombstoned locally -> do not resurrect unless server has a strictly newer update
      if (tombstoneAt && !localItem) {
        const tombMs = parseIsoMs(tombstoneAt);
        const srvMs = parseIsoMs(getEntityUpdatedAt(serverItem));
        if (!serverItem || tombMs >= srvMs) {
          continue;
        }
      }

      // 4. Present on both server and local (with no pending outbox op)
      if (serverItem && localItem) {
        const srvMs = parseIsoMs(getEntityUpdatedAt(serverItem));
        const locMs = parseIsoMs(getEntityUpdatedAt(localItem));

        if (locMs > srvMs && srvMs > 0) {
          const updatedLocal = {
            ...localItem,
            userId: serverState.settings.userId,
          };
          resultList.push(updatedLocal);
          additionalOps.push({
            op: 'upsert',
            entity,
            id,
            data: updatedLocal,
            baseUpdatedAt: getEntityUpdatedAt(serverItem),
            queuedAt: nowIso,
          });
        } else {
          resultList.push(serverItem);
        }
        continue;
      }

      // 5. Only on server (and not deleted locally)
      if (serverItem && !localItem) {
        resultList.push(serverItem);
        continue;
      }

      // 6. Only on local (and no pending op in outbox)
      if (localItem && !serverItem) {
        // Ignore untouched default 'local-user' seed items on first sign-in
        const isDefaultLocalSeed =
          localItem.userId === 'local-user' &&
          /^(area-|inb-|goal-|ms-|task-|rt-)/.test(id) &&
          !/-[0-9a-f]{8}$/.test(id);

        if (!hasSyncedBefore && !isDefaultLocalSeed) {
          const adopted = {
            ...localItem,
            userId: serverState.settings.userId,
          };
          resultList.push(adopted);
          additionalOps.push({
            op: 'upsert',
            entity,
            id,
            data: adopted,
            queuedAt: nowIso,
          });
        }
        // If hasSyncedBefore is true and there is no pending op, the item was deleted on the server -> do not resurrect!
      }
    }

    mergedCollections[entity] = resultList;
  }

  const opsToFlush = coalesceOutboxOps(pendingOutbox, additionalOps);

  return {
    mergedState: {
      settings: mergedSettings,
      lifeAreas:
        (mergedCollections.lifeAreas as unknown as AppStateData['lifeAreas']) ||
        [],
      inboxItems:
        (mergedCollections.inboxItems as unknown as AppStateData['inboxItems']) ||
        [],
      inboxLinks:
        (mergedCollections.inboxLinks as unknown as AppStateData['inboxLinks']) ||
        [],
      goals:
        (mergedCollections.goals as unknown as AppStateData['goals']) || [],
      projects:
        (mergedCollections.projects as unknown as AppStateData['projects']) ||
        [],
      milestones:
        (mergedCollections.milestones as unknown as AppStateData['milestones']) ||
        [],
      tasks:
        (mergedCollections.tasks as unknown as AppStateData['tasks']) || [],
      dayPlans:
        (mergedCollections.dayPlans as unknown as AppStateData['dayPlans']) ||
        [],
      routines:
        (mergedCollections.routines as unknown as AppStateData['routines']) ||
        [],
      routineLogs:
        (mergedCollections.routineLogs as unknown as AppStateData['routineLogs']) ||
        [],
      dailyReviews:
        (mergedCollections.dailyReviews as unknown as AppStateData['dailyReviews']) ||
        [],
      weeklyReviews:
        (mergedCollections.weeklyReviews as unknown as AppStateData['weeklyReviews']) ||
        [],
      reminderSent: serverState.reminderSent || localState.reminderSent || [],
    },
    opsToFlush,
  };
}

/**
 * Pure conflict & acknowledgment resolver after POST /api/mutate completes.
 * - Removes acknowledged ops (unless superseded by a newer local edit in the outbox).
 * - When a conflict is returned ({ conflict: true, serverRow }), applies last-write-wins
 *   by updatedAt and counts conflicts so the UI can show "Doosre device ka naya change mila".
 */
export function resolveMutationResults(params: {
  currentState: AppStateData;
  pendingOutbox: MutationOp[];
  sentOps: MutationOp[];
  results: MutationOpResult[];
}): {
  nextState: AppStateData;
  remainingOutbox: MutationOp[];
  conflictCount: number;
} {
  const { currentState, pendingOutbox, sentOps, results } = params;

  const sentMap = new Map<string, MutationOp>();
  for (const op of sentOps) {
    sentMap.set(`${op.entity}:${op.id}`, op);
  }

  const outboxMap = new Map<string, MutationOp>();
  for (const op of pendingOutbox) {
    outboxMap.set(`${op.entity}:${op.id}`, { ...op });
  }

  let nextState: AppStateData = {
    ...currentState,
    settings: { ...currentState.settings },
  };
  let conflictCount = 0;

  for (const res of results) {
    const key = `${res.entity}:${res.id}`;
    const sentOp = sentMap.get(key);
    const currentOutboxOp = outboxMap.get(key);

    // Check if the user edited this entity again while the request was in flight
    const editedWhileInFlight =
      currentOutboxOp &&
      sentOp &&
      parseIsoMs(currentOutboxOp.queuedAt) > parseIsoMs(sentOp.queuedAt);

    if (res.ok) {
      if (!editedWhileInFlight) {
        outboxMap.delete(key);
      } else if (currentOutboxOp) {
        outboxMap.set(key, {
          ...currentOutboxOp,
          baseUpdatedAt: res.updatedAt,
        });
      }

      if (res.op === 'upsert' && res.entity !== 'settings') {
        const list = (nextState[res.entity] || []) as unknown as Array<
          Record<string, unknown> & { id: string }
        >;
        nextState = {
          ...nextState,
          [res.entity]: list.map((item) =>
            item.id === res.id ? { ...item, updatedAt: res.updatedAt } : item
          ),
        };
      }
      continue;
    }

    // res.conflict === true
    conflictCount += 1;
    const serverRow = res.serverRow;
    const serverMs = parseIsoMs(getEntityUpdatedAt(serverRow));

    if (res.entity === 'settings') {
      const localMs = parseIsoMs(getEntityUpdatedAt(nextState.settings));
      if (serverMs >= localMs) {
        nextState = {
          ...nextState,
          settings: {
            ...nextState.settings,
            ...(serverRow as unknown as AppStateData['settings']),
          },
        };
        outboxMap.delete(key);
      } else if (currentOutboxOp) {
        outboxMap.set(key, {
          ...currentOutboxOp,
          baseUpdatedAt: getEntityUpdatedAt(serverRow),
        });
      }
      continue;
    }

    const list = (nextState[res.entity] || []) as unknown as Array<
      Record<string, unknown> & { id: string }
    >;
    const localItem = list.find((item) => item.id === res.id);
    const localMs = parseIsoMs(getEntityUpdatedAt(localItem));

    if (!localItem || serverMs >= localMs) {
      // Server row is newer (or equal): apply serverRow and clear outbox op
      const exists = Boolean(localItem);
      const updatedList = exists
        ? list.map((item) => (item.id === res.id ? { ...serverRow, id: res.id } : item))
        : [...list, { ...serverRow, id: res.id }];
      nextState = {
        ...nextState,
        [res.entity]: updatedList,
      };
      outboxMap.delete(key);
    } else if (currentOutboxOp) {
      // Local row has a strictly newer updatedAt: keep local row and rebase baseUpdatedAt
      outboxMap.set(key, {
        ...currentOutboxOp,
        baseUpdatedAt: getEntityUpdatedAt(serverRow),
      });
    }
  }

  return {
    nextState,
    remainingOutbox: Array.from(outboxMap.values()),
    conflictCount,
  };
}

/**
 * Hand-written validator for POST /api/mutate payload ({ ops: [...] }).
 */
export function validateMutatePayload(payload: unknown): {
  ok: boolean;
  errors: string[];
  ops: MutationOp[];
} {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      errors: ['Payload must be a JSON object.'],
      ops: [],
    };
  }

  const obj = payload as Record<string, unknown>;
  if (!Array.isArray(obj.ops)) {
    return {
      ok: false,
      errors: ['Field "ops" must be an array.'],
      ops: [],
    };
  }

  if (obj.ops.length === 0) {
    return {
      ok: true,
      errors: [],
      ops: [],
    };
  }

  if (obj.ops.length > MAX_MUTATION_OPS) {
    return {
      ok: false,
      errors: [`Too many ops (${obj.ops.length}). Maximum is ${MAX_MUTATION_OPS}.`],
      ops: [],
    };
  }

  const validEntities = new Set<string>(SYNC_ENTITIES);
  const validatedOps: MutationOp[] = [];

  for (let i = 0; i < obj.ops.length; i++) {
    const raw = obj.ops[i];
    if (!raw || typeof raw !== 'object') {
      errors.push(`ops[${i}] must be an object.`);
      break;
    }
    const item = raw as Record<string, unknown>;
    if (item.op !== 'upsert' && item.op !== 'delete') {
      errors.push(`ops[${i}].op must be "upsert" or "delete".`);
      break;
    }
    if (typeof item.entity !== 'string' || !validEntities.has(item.entity)) {
      errors.push(`ops[${i}].entity is invalid.`);
      break;
    }
    if (
      typeof item.id !== 'string' ||
      item.id.trim().length === 0 ||
      item.id.length > 160
    ) {
      errors.push(`ops[${i}].id must be a non-empty string <= 160 chars.`);
      break;
    }
    if (
      item.baseUpdatedAt !== undefined &&
      item.baseUpdatedAt !== null &&
      (typeof item.baseUpdatedAt !== 'string' || item.baseUpdatedAt.length > 64)
    ) {
      errors.push(`ops[${i}].baseUpdatedAt must be an ISO string.`);
      break;
    }
    if (item.op === 'upsert') {
      if (
        !item.data ||
        typeof item.data !== 'object' ||
        Array.isArray(item.data)
      ) {
        errors.push(`ops[${i}].data must be an object for upsert.`);
        break;
      }
    }

    validatedOps.push({
      op: item.op,
      entity: item.entity as SyncEntityName,
      id: item.id.trim(),
      data:
        item.op === 'upsert'
          ? (item.data as Record<string, unknown>)
          : undefined,
      baseUpdatedAt:
        typeof item.baseUpdatedAt === 'string'
          ? item.baseUpdatedAt
          : undefined,
      queuedAt:
        typeof item.queuedAt === 'string'
          ? item.queuedAt
          : new Date().toISOString(),
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    ops: validatedOps,
  };
}
