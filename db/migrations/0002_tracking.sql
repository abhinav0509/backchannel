-- Where each opportunity stands with you, kept apart from research status.
alter table opportunities add column if not exists pipeline text not null default 'new'
  check (pipeline in ('new', 'interested', 'screening', 'interviewing', 'offer', 'back_pocket', 'on_hold', 'passed', 'closed'));
alter table opportunities add column if not exists pipeline_reason text;
alter table opportunities add column if not exists pipeline_at timestamptz not null default now();
alter table opportunities add column if not exists notes text not null default '';
alter table opportunities add column if not exists next_step text;
alter table opportunities add column if not exists next_step_at text check (next_step_at ~ '^\d{4}-\d{2}-\d{2}$');
alter table opportunities add column if not exists prep jsonb not null default '{}';

-- Runs started in the same millisecond tied on started_at; a sequence gives them a true order.
alter table runs add column if not exists seq bigint generated always as identity;
