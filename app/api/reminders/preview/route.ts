import { NextRequest, NextResponse } from 'next/server';
import {
  isEmailAllowed,
  NO_STORE_HEADERS,
  verifyBearerUser,
} from '@/src/lib/auth-server';
import { getUserFullState } from '@/src/db/repository';
import { evaluateReminderTick } from '@/src/lib/logic/tick-logic';
import { nowMinutes, todayLocal } from '@/src/lib/logic/dates';
import { createInitialSeedData } from '@/src/lib/seed-data';

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
      { error: 'Forbidden: Access denied' },
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

    const body = rawBody
      ? (JSON.parse(rawBody) as { overrideNowMin?: unknown })
      : {};

    let state;
    try {
      state = await getUserFullState(decoded.uid, decoded.email || '');
    } catch {
      state = createInitialSeedData(decoded.uid);
    }

    const tz = state.settings.timezone || 'Asia/Kolkata';
    const rollover = state.settings.dayRolloverHour ?? 4;
    const todayDate = todayLocal(tz, rollover);

    let currentMin = nowMinutes(tz);
    if (
      typeof body.overrideNowMin === 'number' &&
      Number.isInteger(body.overrideNowMin) &&
      body.overrideNowMin >= 0 &&
      body.overrideNowMin < 1440
    ) {
      currentMin = body.overrideNowMin;
    }

    const dayPlan = state.dayPlans.find((dp) => dp.planDate === todayDate);
    const hasDailyReviewToday = state.dailyReviews.some(
      (dr) => dr.reviewDate === todayDate
    );

    const evaluation = evaluateReminderTick({
      todayDate,
      nowMin: currentMin,
      settings: state.settings,
      dayPlan,
      routines: state.routines,
      routineLogs: state.routineLogs,
      reminderSentToday: state.reminderSent.filter(
        (r) => r.logDate === todayDate
      ),
      hasDailyReviewToday,
    });

    // Preview route MUST NEVER sign done tokens
    const unsignedActions =
      evaluation.digestNotification?.actions.map((a) => ({
        ...a,
        token: null,
      })) || [];

    return NextResponse.json(
      {
        todayDate,
        nowMin: currentMin,
        skippedQuietHours: evaluation.skippedQuietHours,
        skippedCapReached: evaluation.skippedCapReached,
        dueCount: evaluation.dueItems.length,
        digestNotification: evaluation.digestNotification
          ? {
              ...evaluation.digestNotification,
              actions: unsignedActions,
            }
          : null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(`[Reminder Preview] Evaluation failed (${errClass}).`);
    return NextResponse.json(
      { error: 'Reminder preview failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
