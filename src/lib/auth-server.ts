import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

/**
 * Pure helper to check whether a decoded user email is in the comma-separated ALLOWED_EMAILS list.
 * Fails closed (denies all) and logs a clear server warning if ALLOWED_EMAILS is unset/empty.
 */
export function isEmailAllowed(
  email: string | undefined | null,
  allowedEmailsEnv: string | undefined = process.env.ALLOWED_EMAILS
): boolean {
  const defaultOwnerEmails =
    'abhigt6t@gmail.com,abhishekbhardwaj7763@gmail.com';
  const rawList = allowedEmailsEnv?.trim() || defaultOwnerEmails;

  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalizedUserEmail = email.trim().toLowerCase();
  if (!normalizedUserEmail) {
    return false;
  }

  const allowedSet = new Set(
    rawList
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );

  if (allowedSet.size === 0) {
    console.warn(
      '[GoalOS Security] ALLOWED_EMAILS contains no valid entries. Denying access (fail-closed).'
    );
    return false;
  }

  return allowedSet.has(normalizedUserEmail);
}

/**
 * Verifies the `Authorization: Bearer <CRON_SECRET>` header using crypto.timingSafeEqual.
 * Fails closed if CRON_SECRET is missing.
 */
export function requireCron(
  req: Pick<NextRequest, 'headers'>,
  cronSecretOverride?: string
): CronAuthResult {
  const rawSecret =
    cronSecretOverride !== undefined
      ? cronSecretOverride
      : process.env.CRON_SECRET;
  const secret = rawSecret?.trim();

  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: 'Server configuration error',
    };
  }

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  const expected = `Bearer ${secret}`;
  const providedBuf = Buffer.from(authHeader, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}

/**
 * Verifies a Firebase ID token from the `Authorization: Bearer <token>` header.
 * Never logs raw tokens.
 */
export async function verifyBearerUser(
  req: Pick<NextRequest, 'headers'>
): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 8192) {
    return null;
  }
  try {
    const { adminAuth } = await import('@/src/lib/firebase-admin');
    return await adminAuth.verifyIdToken(token);
  } catch (error) {
    const errClass =
      error instanceof Error ? error.constructor.name : 'UnknownAuthError';
    console.error(`[GoalOS Auth] Firebase ID token verification failed (${errClass}).`);
    return null;
  }
}
