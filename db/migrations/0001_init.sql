-- Backchannel schema. Runs on Supabase (Postgres 15+) and on PGlite in tests.
-- The server talks to Postgres directly and scopes every query by owner_id.
-- RLS is on everywhere as the second line of defence, and so the browser's
-- Realtime subscription only ever sees the signed-in user's own rows.

create table if not exists opportunities (
  id text primary key,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  text text not null,
  company text,
  role text,
  domain text,
  status text not null default 'idle' check (status in ('idle', 'running', 'needs_choice', 'done', 'failed')),
  candidates jsonb not null default '[]',
  choice_reason text,
  error text,
  triage jsonb,
  report jsonb
);
create index if not exists opportunities_owner_created on opportunities (owner_id, created_at desc);

create table if not exists runs (
  id text primary key,
  opportunity_id text not null references opportunities (id) on delete cascade,
  owner_id uuid not null,
  mode text not null check (mode in ('triage', 'deep')),
  status text not null default 'running' check (status in ('running', 'needs_choice', 'done', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  workflow_run_id text -- set when a durable workflow executes the run
);
create index if not exists runs_opportunity on runs (opportunity_id, started_at);

-- Append-only, so parallel stages never overwrite each other's progress.
create table if not exists run_events (
  id bigint generated always as identity primary key,
  run_id text not null references runs (id) on delete cascade,
  opportunity_id text not null references opportunities (id) on delete cascade,
  owner_id uuid not null,
  stage text not null,
  status text not null,
  at timestamptz not null default now(),
  output jsonb,
  error text
);
create index if not exists run_events_run on run_events (run_id, id);

-- One row per billed API call. Run totals and the monthly cap are sums over this table,
-- so concurrent stages never race on a shared counter.
create table if not exists spend (
  id bigint generated always as identity primary key,
  run_id text references runs (id) on delete set null,
  stage text not null,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  cache_read_tokens int not null,
  cache_write_tokens int not null,
  searches int not null,
  usd numeric(12, 6) not null,
  at timestamptz not null default now()
);
create index if not exists spend_at on spend (at);
create index if not exists spend_run on spend (run_id);

-- Identical API requests are served from here, keyed by a hash of the whole request.
create table if not exists llm_cache (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  owner_id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table opportunities enable row level security;
alter table runs enable row level security;
alter table run_events enable row level security;
alter table profiles enable row level security;
alter table spend enable row level security;      -- server only: no policies
alter table llm_cache enable row level security;  -- server only: no policies

-- auth.uid() exists on Supabase; tests provide a stub before running this file.
drop policy if exists "own opportunities" on opportunities;
create policy "own opportunities" on opportunities for select to authenticated using (owner_id = auth.uid());
drop policy if exists "own runs" on runs;
create policy "own runs" on runs for select to authenticated using (owner_id = auth.uid());
drop policy if exists "own run events" on run_events;
create policy "own run events" on run_events for select to authenticated using (owner_id = auth.uid());
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select to authenticated using (owner_id = auth.uid());

-- Live progress: the browser subscribes to new run events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'run_events') then
    alter publication supabase_realtime add table run_events;
  end if;
end $$;
