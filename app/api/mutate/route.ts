import { NextRequest, NextResponse } from 'next/server';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';
import {
  applyUserMutationOps,
  OwnershipConflictError,
} from '@/src/db/repository';
import { validateMutatePayload } from '@/src/lib/logic/sync';

const MAX_MUTATE_BODY_BYTES = 1024 * 1024; // 1 MB

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
    if (Buffer.byteLength(rawText, 'utf8') > MAX_MUTATE_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Payload exceeds maximum allowed size' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const validation = validateMutatePayload(body);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.errors.join(' ') },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const results = await applyUserMutationOps(
      decoded.uid,
      decoded.email || '',
      validation.ops
    );

    const hasConflict = results.some((r) => r.conflict);

    return NextResponse.json(
      {
        ok: true,
        hasConflict,
        results,
      },
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
    console.error(`[Mutate POST] Failed to apply mutation ops (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to apply mutations' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405, headers: NO_STORE_HEADERS }
  );
}
