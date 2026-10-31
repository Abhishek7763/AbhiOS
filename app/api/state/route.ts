import { NextRequest, NextResponse } from 'next/server';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';
import {
  getUserFullState,
  OwnershipConflictError,
  saveUserFullState,
} from '@/src/db/repository';
import {
  validateImportPayload,
  validateSyncStatePayload,
} from '@/src/lib/logic/quality-gate';
import { AppStateData, ExportPayload } from '@/src/lib/types';

const MAX_STATE_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

export async function GET(req: NextRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  const decoded = await verifyBearerUser(req);
  if (!decoded) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!isEmailAllowed(decoded.email)) {
    return NextResponse.json(
      { error: 'Forbidden: Email not in allowlist', code: 'ACCESS_DENIED' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const state = await getUserFullState(decoded.uid, decoded.email || '');
    return NextResponse.json(
      { synced: true, state },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    if (error instanceof OwnershipConflictError) {
      return NextResponse.json(
        { error: 'Conflict: Ownership mismatch' },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[State GET] Failed to load state (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to load state' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  const decoded = await verifyBearerUser(req);
  if (!decoded) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!isEmailAllowed(decoded.email)) {
    return NextResponse.json(
      { error: 'Forbidden: Email not in allowlist', code: 'ACCESS_DENIED' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const rawText = await req.text();
    if (Buffer.byteLength(rawText, 'utf8') > MAX_STATE_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Payload exceeds maximum allowed size' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (body.action === 'import') {
      const validation = validateImportPayload(body.payload);
      if (!validation.ok) {
        return NextResponse.json(
          { error: validation.errors.join(' ') },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const importPayload = body.payload as ExportPayload;
      const isReplace =
        body.mode === 'replace' || body.mode === 'replace-empty';
      await saveUserFullState(
        decoded.uid,
        decoded.email || '',
        importPayload.tables,
        { replace: isReplace }
      );
      const updated = await getUserFullState(decoded.uid, decoded.email || '');
      return NextResponse.json(
        { ok: true, state: updated },
        { headers: NO_STORE_HEADERS }
      );
    }

    // Legacy full-state sync kept for one release behind feature flag LEGACY_FULL_STATE_SYNC
    if (process.env.LEGACY_FULL_STATE_SYNC === 'false') {
      return NextResponse.json(
        {
          error:
            'Legacy full-state sync is disabled. Use POST /api/mutate for incremental sync.',
        },
        { status: 410, headers: NO_STORE_HEADERS }
      );
    }

    if (!body.state) {
      return NextResponse.json(
        { error: 'Missing state payload' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const syncValidation = validateSyncStatePayload(body.state);
    if (!syncValidation.ok) {
      return NextResponse.json(
        { error: syncValidation.errors.join(' ') },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await saveUserFullState(
      decoded.uid,
      decoded.email || '',
      body.state as AppStateData
    );
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof OwnershipConflictError) {
      return NextResponse.json(
        { error: 'Conflict: Ownership mismatch' },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[State POST] Failed to save state (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to save state' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
