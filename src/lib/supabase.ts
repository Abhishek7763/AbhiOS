import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppStateData } from '@/src/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  if (
    typeof supabaseUrl !== 'string' ||
    typeof supabaseAnonKey !== 'string' ||
    !supabaseUrl.trim() ||
    !supabaseAnonKey.trim()
  ) {
    return false;
  }
  const cleanUrl = supabaseUrl.trim().toLowerCase();
  if (
    !cleanUrl.startsWith('https://') ||
    cleanUrl.includes('your-project-id') ||
    cleanUrl.includes('placeholder')
  ) {
    return false;
  }
  return true;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch {
      supabaseInstance = null;
    }
  }
  return supabaseInstance;
}

/**
 * Saves a full state snapshot directly into Supabase 'user_state_snapshots' table
 * or individual relational tables if provisioned.
 */
export async function syncStateToSupabase(
  userId: string,
  state: AppStateData
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      error: 'Supabase URL ya Anon Key configure nahi hai (.env me dalein).',
    };
  }

  try {
    const { error } = await client.from('user_state_snapshots').upsert(
      {
        user_id: userId,
        state_data: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.warn('[Supabase Sync] Snapshot upsert error:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown Supabase error';
    return { success: false, error: msg };
  }
}

/**
 * Loads a full state snapshot from Supabase for the authenticated user.
 */
export async function fetchStateFromSupabase(
  userId: string
): Promise<{ success: boolean; state?: AppStateData; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await client
      .from('user_state_snapshots')
      .select('state_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.state_data) {
      return { success: true, state: data.state_data as AppStateData };
    }

    return { success: true, state: undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown Supabase error';
    return { success: false, error: msg };
  }
}
