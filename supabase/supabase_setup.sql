-- ============================================================================
-- ABHIOS / PERSONAL GOAL OS - SUPABASE SETUP SCRIPT
-- Run this in your Supabase Project -> SQL Editor
-- ============================================================================

-- 1. Create user_state_snapshots table for persistent state synchronization
create table if not exists public.user_state_snapshots (
  user_id text primary key,
  state_data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.user_state_snapshots enable row level security;

-- 3. Policy: Allow anon key or authenticated owner to read and write state
-- (Since single-user AbhiOS validates credentials server-side or via Supabase Auth)
drop policy if exists "user_state_snapshots_allow_all" on public.user_state_snapshots;
create policy "user_state_snapshots_allow_all"
  on public.user_state_snapshots
  for all
  to public
  using (true)
  with check (true);

-- 4. Fast index for user lookups
create index if not exists idx_user_state_snapshots_uid on public.user_state_snapshots (user_id);

-- Success verification:
select count(*) as snapshot_table_ready from public.user_state_snapshots;
