-- What each model call in a run did: the searches it made, what it found and cited, each
-- extraction attempt and what was dropped. Read by the run inspector; spend stays the ledger.
create table if not exists run_calls (
  id bigint generated always as identity primary key,
  run_id text not null references runs (id) on delete cascade,
  owner_id uuid not null,
  stage text not null,
  kind text not null check (kind in ('search', 'structured')),
  model text not null,
  at timestamptz not null default now(),
  ms int not null,
  cached boolean not null,
  usd numeric(12, 6) not null,
  input_tokens int not null,
  output_tokens int not null,
  searches int not null,
  detail jsonb not null default '{}'
);
create index if not exists run_calls_run on run_calls (run_id, id);
alter table run_calls enable row level security;
drop policy if exists "own run calls" on run_calls;
create policy "own run calls" on run_calls for select to authenticated using (owner_id = auth.uid());

-- A read-only link to a report. Unguessable; null when not shared.
alter table opportunities add column if not exists share_id text unique;
alter table opportunities add column if not exists shared_at timestamptz;
