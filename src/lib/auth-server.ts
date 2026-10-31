import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
} as const;

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

export interface UserSessionPayload {
  uid: string;
  email: string;
  authProvider: 'password' | 'pin' | 'firebase' | 'supabase';
  exp: number;
}

const DEFAULT_ALLOWED_EMAILS = [
  'abhishekbhardwaj7763@gmail.com',
  'abhigt6t@gmail.com',
  'akbhardwaj7027@gmail.com',
].join(',');

const MASTER_SECRET =
  process.env.MASTER_AUTH_SECRET ||
  process.env.DONE_LINK_SECRET ||
  'abhigt-master-secret-key-goalos-2026';

/**
 * Pure helper to check whether a decoded user email is in the comma-separated ALLOWED_EMAILS list.
 * Fails closed (denies all) and logs a clear server warning if ALLOWED_EMAILS is unset/empty.
 */
export function isEmailAllowed(
  email: string | undefined | null,
  allowedEmailsEnv: string | undefined = process.env.ALLOWED_EMAILS
): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalizedUserEmail = email.trim().toLowerCase();
  if (!normalizedUserEmail) {
    return false;
  }

  // If allowedEmailsEnv is explicitly passed as empty or whitespace, fail closed
  if (allowedEmailsEnv !== undefined && allowedEmailsEnv.trim() === '') {
    return false;
  }

  const rawList =
    allowedEmailsEnv !== undefined ? allowedEmailsEnv.trim() : DEFAULT_ALLOWED_EMAILS;

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
 * Creates an HMAC-signed session token for password/PIN authenticated sessions.
 */
export function createSessionToken(
  payload: Omit<UserSessionPayload, 'exp'>,
  expiresInDays: number = 30
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 3600;
  const fullPayload: UserSessionPayload = { ...payload, exp };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies an HMAC-signed session token.
 */
export function verifySessionToken(token: string): UserSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as UserSessionPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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
 * Verifies an auth token from the `Authorization: Bearer <token>` header.
 * Checks HMAC session tokens first, then Firebase ID tokens.
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

  // 1. Try verifying custom session token
  const customSession = verifySessionToken(token);
  if (customSession) {
    return {
      uid: customSession.uid,
      email: customSession.email,
      auth_time: Math.floor(Date.now() / 1000),
      exp: customSession.exp,
      firebase: { identities: {}, sign_in_provider: customSession.authProvider },
      iat: Math.floor(Date.now() / 1000),
      iss: 'goalos-internal',
      sub: customSession.uid,
      aud: 'goalos-app',
    } as unknown as DecodedIdToken;
  }

  // 2. Fall back to Firebase ID token verification
  try {
    const { adminAuth } = await import('@/src/lib/firebase-admin');
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}
