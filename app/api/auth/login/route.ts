import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  isEmailAllowed,
  NO_STORE_HEADERS,
} from '@/src/lib/auth-server';

const MASTER_PASSWORD = process.env.MASTER_AUTH_PASS || 'Abhi@7763';
const MASTER_PIN = process.env.MASTER_PIN || '702711';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, id, pass, pin, rememberMe } = body || {};

    // 1. PIN-based quick unlock
    if (type === 'pin') {
      const cleanPin = String(pin || '').trim();
      const validPins = [
        MASTER_PIN.trim(),
        '702711',
        process.env.MASTER_PIN?.trim(),
      ].filter(Boolean);

      if (!cleanPin || !validPins.includes(cleanPin)) {
        return NextResponse.json(
          { ok: false, error: 'Galat PIN. Kripya dobara koshish karein.' },
          { status: 401, headers: NO_STORE_HEADERS }
        );
      }

      const uid = 'owner_abhi_pin';
      const email = 'abhishekbhardwaj7763@gmail.com';
      const token = createSessionToken(
        { uid, email, authProvider: 'pin' },
        rememberMe ? 60 : 7
      );

      return NextResponse.json(
        {
          ok: true,
          token,
          user: {
            uid,
            email,
            displayName: 'Abhishek',
            authProvider: 'pin',
          },
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // 2. ID / Email + Password login
    const cleanId = String(id || '').trim().toLowerCase();
    const cleanPass = String(pass || '');

    if (!cleanId || !cleanPass) {
      return NextResponse.json(
        { ok: false, error: 'ID aur Password dono likhna zaruri hai.' },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    // Check if ID is one of Abhishek's 3 Gmails or allowed username
    const isIdRecognized =
      cleanId.startsWith('abhi') ||
      cleanId.includes('abhigt6t') ||
      cleanId.includes('abhishekbhardwaj') ||
      isEmailAllowed(cleanId);

    const validPasswords = [
      MASTER_PASSWORD,
      'Abhi@7763',
      process.env.MASTER_AUTH_PASS,
    ].filter(Boolean);

    const isPassValid = validPasswords.includes(cleanPass);

    if (!isIdRecognized || !isPassValid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Galat ID ya Password. Kripya check karke dobara koshish karein.',
        },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const email = cleanId.includes('@') ? cleanId : 'abhishekbhardwaj7763@gmail.com';
    const uid = `owner_${cleanId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const token = createSessionToken(
      { uid, email, authProvider: 'password' },
      rememberMe ? 90 : 7
    );

    return NextResponse.json(
      {
        ok: true,
        token,
        user: {
          uid,
          email,
          displayName: 'Abhishek',
          authProvider: 'password',
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json(
      { ok: false, error: `Login error: ${msg}` },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
