-- What testers tell you from inside the app, with the page they were on.
create table if not exists feedback (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  page text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created on feedback (created_at desc);
alter table feedback enable row level security; -- server only: no policies
