import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { pushSubscriptions, userSettings } from '@/src/db/schema';
import { getOrCreateUser } from '@/src/db/repository';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';

function isValidPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false;
  const trimmed = endpoint.trim();
  if (trimmed.length < 12 || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && parsed.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

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
    if (rawBody.length > 8192) {
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
    const keys = body.keys as Record<string, unknown> | undefined;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    const userAgent =
      typeof body.userAgent === 'string'
        ? body.userAgent.slice(0, 512)
        : req.headers.get('user-agent')?.slice(0, 512) || null;

    if (
      !isValidPushEndpoint(endpoint) ||
      typeof p256dh !== 'string' ||
      p256dh.trim().length === 0 ||
      p256dh.length > 512 ||
      typeof auth !== 'string' ||
      auth.trim().length === 0 ||
      auth.length > 256
    ) {
      return NextResponse.json(
        { error: 'Invalid push subscription payload' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await getOrCreateUser(user.uid, user.email || '');

    const endpointHash = crypto
      .createHash('sha256')
      .update(endpoint.trim())
      .digest('hex')
      .slice(0, 24);
    const subId = `psub_${endpointHash}`;

    const upserted = await db
      .insert(pushSubscriptions)
      .values({
        id: subId,
        userId: user.uid,
        endpoint: endpoint.trim(),
        p256dh: p256dh.trim(),
        auth: auth.trim(),
        userAgent,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: p256dh.trim(),
          auth: auth.trim(),
          userAgent,
        },
        setWhere: eq(pushSubscriptions.userId, user.uid),
      })
      .returning({ id: pushSubscriptions.id });

    if (!upserted || upserted.length === 0) {
      return NextResponse.json(
        { error: 'Push subscription ownership conflict' },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    await db
      .insert(userSettings)
      .values({
        userId: user.uid,
        pushEnabled: true,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          pushEnabled: true,
          updatedAt: new Date(),
        },
        setWhere: eq(userSettings.userId, user.uid),
      });

    return NextResponse.json(
      { ok: true, id: upserted[0].id },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[Push Subscribe] Failed (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
