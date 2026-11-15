-- Each person's spend, so invitees can be capped per month on top of the overall cap.
alter table spend add column if not exists owner_id uuid;
update spend s set owner_id = r.owner_id from runs r where s.run_id = r.id and s.owner_id is null;
create index if not exists spend_owner_at on spend (owner_id, at);

-- Interview rounds for an opportunity: when, what kind, who, and how it went.
create table if not exists rounds (
  id text primary key,
  opportunity_id text not null references opportunities (id) on delete cascade,
  owner_id uuid not null,
  kind text not null check (kind in ('recruiter_screen', 'hiring_manager', 'portfolio_review', 'design_exercise', 'panel', 'onsite', 'final', 'other')),
  at timestamptz, -- null until it is scheduled
  format text not null default 'video' check (format in ('video', 'phone', 'onsite')),
  interviewers jsonb not null default '[]',
  notes text not null default '',
  outcome text not null default 'pending' check (outcome in ('pending', 'passed', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now()
);
create index if not exists rounds_opportunity on rounds (opportunity_id, at);
alter table rounds enable row level security;
drop policy if exists "own rounds" on rounds;
create policy "own rounds" on rounds for select to authenticated using (owner_id = auth.uid());
