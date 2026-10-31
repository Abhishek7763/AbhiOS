import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/src/db';
import { NO_STORE_HEADERS, requireCron } from '@/src/lib/auth-server';

export async function GET(req: NextRequest) {
  if (req.method !== 'GET') {
    return NextResponse.json(
      { error: 'Method Not Allowed' },
      { status: 405, headers: NO_STORE_HEADERS }
    );
  }

  const cronAuth = requireCron(req);
  if (!cronAuth.ok) {
    return NextResponse.json(
      { error: cronAuth.error },
      { status: cronAuth.status, headers: NO_STORE_HEADERS }
    );
  }

  try {
    await pool.query('SELECT 1');
    return NextResponse.json(
      { db: true },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { db: false },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
