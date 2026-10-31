import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { pushSubscriptions } from '@/src/db/schema';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';
import {
  resolveVapidConfig,
  sendWebPushToUserSubscriptions,
} from '@/src/lib/push-server';

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

  const vapidConfig = resolveVapidConfig();
  if (!vapidConfig) {
    return NextResponse.json(
      { error: 'VAPID configuration missing on server' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.uid));

    if (subs.length === 0) {
      return NextResponse.json(
        { error: 'No active push subscriptions found for this account' },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const payload = {
      title: 'Goal OS Test Reminder',
      body: 'Web Push kaam kar raha hai! Aaj ke routines aur paani track karein.',
      tag: 'goalos-test-push',
      url: '/?tab=today',
      actions: [],
      data: {
        url: '/?tab=today',
      },
    };

    const { sent, removed } = await sendWebPushToUserSubscriptions(
      user.uid,
      subs,
      payload,
      vapidConfig
    );

    return NextResponse.json(
      { ok: true, sent, removed },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[Push Test] Failed (${errClass}).`);
    return NextResponse.json(
      { error: 'Failed to send test push' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
