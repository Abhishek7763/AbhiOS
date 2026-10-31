import crypto from 'node:crypto';

export type DoneTokenAction = 'done' | 'water' | 'snooze';

export interface DoneTokenPayload {
  uid: string;
  rid: string;
  date: string;
  act: DoneTokenAction;
  exp: number;
}

export type VerifyDoneTokenResult =
  | { ok: true; payload: DoneTokenPayload }
  | { ok: false; status: 400 | 401 | 500; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEX_SIG_RE = /^[a-f0-9]{64}$/i;

function resolveDoneLinkSecret(secretOverride?: string): string | null {
  const raw =
    secretOverride !== undefined ? secretOverride : process.env.DONE_LINK_SECRET;
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function buildCanonicalString(payload: DoneTokenPayload): string {
  return `${payload.uid}|${payload.rid}|${payload.date}|${payload.act}|${payload.exp}`;
}

export function validateDoneTokenPayloadShape(
  value: unknown
): value is DoneTokenPayload & { sig: string } {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  if (
    typeof obj.uid !== 'string' ||
    obj.uid.trim().length === 0 ||
    obj.uid.length > 128
  ) {
    return false;
  }
  if (
    typeof obj.rid !== 'string' ||
    obj.rid.trim().length === 0 ||
    obj.rid.length > 128
  ) {
    return false;
  }
  if (typeof obj.date !== 'string' || !DATE_RE.test(obj.date)) {
    return false;
  }
  if (
    obj.act !== 'done' &&
    obj.act !== 'water' &&
    obj.act !== 'snooze'
  ) {
    return false;
  }
  if (
    typeof obj.exp !== 'number' ||
    !Number.isFinite(obj.exp) ||
    !Number.isInteger(obj.exp) ||
    obj.exp <= 0
  ) {
    return false;
  }
  if (typeof obj.sig !== 'string' || !HEX_SIG_RE.test(obj.sig)) {
    return false;
  }
  return true;
}

export function signDoneToken(
  payload: DoneTokenPayload,
  secretOverride?: string
): string {
  const secret = resolveDoneLinkSecret(secretOverride);
  if (!secret) {
    throw new Error('DONE_LINK_SECRET is not configured.');
  }

  if (
    !payload ||
    typeof payload.uid !== 'string' ||
    !payload.uid.trim() ||
    typeof payload.rid !== 'string' ||
    !payload.rid.trim() ||
    !DATE_RE.test(payload.date) ||
    (payload.act !== 'done' &&
      payload.act !== 'water' &&
      payload.act !== 'snooze') ||
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp)
  ) {
    throw new Error('Invalid done token payload shape.');
  }

  const raw = buildCanonicalString(payload);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString('base64url');
}

export function verifyDoneToken(
  token: string,
  nowMs: number = Date.now(),
  secretOverride?: string
): VerifyDoneTokenResult {
  const secret = resolveDoneLinkSecret(secretOverride);
  if (!secret) {
    return {
      ok: false,
      status: 500,
      error: 'Server configuration error',
    };
  }

  if (!token || typeof token !== 'string' || token.length > 2048) {
    return {
      ok: false,
      status: 400,
      error: 'Malformed token',
    };
  }

  let parsed: unknown;
  try {
    const jsonStr = Buffer.from(token, 'base64url').toString('utf8');
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Malformed token',
    };
  }

  if (!validateDoneTokenPayloadShape(parsed)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid token shape',
    };
  }

  const raw = buildCanonicalString(parsed);
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(raw)
    .digest('hex');

  const sigBuf = Buffer.from(parsed.sig.toLowerCase(), 'utf8');
  const expectedBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');

  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return {
      ok: false,
      status: 401,
      error: 'Invalid token signature',
    };
  }

  if (nowMs > parsed.exp) {
    return {
      ok: false,
      status: 401,
      error: 'Token expired',
    };
  }

  return {
    ok: true,
    payload: {
      uid: parsed.uid,
      rid: parsed.rid,
      date: parsed.date,
      act: parsed.act,
      exp: parsed.exp,
    },
  };
}
