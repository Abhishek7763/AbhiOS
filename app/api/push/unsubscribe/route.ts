import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { pushSubscriptions } from '@/src/db/schema';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  const user = await verifyBearerUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid token' },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!isEmailAllowed(user.email)) {
    return NextResponse.json(
      { error: 'Forbidden: Email not in allowlist' },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > 4096) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const endpoint = body.endpoint;
    if (
      typeof endpoint !== 'string' ||
      endpoint.trim().length === 0 ||
      endpoint.length > 2048
    ) {
      return NextResponse.json(
        { error: 'Invalid endpoint' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const deleted = await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint.trim()),
          eq(pushSubscriptions.userId, user.uid)
        )
      )
      .returning({ id: pushSubscriptions.id });

    return NextResponse.json(
      { ok: true, removed: deleted.length },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[Push Unsubscribe] Failed (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
