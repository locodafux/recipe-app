-- In-app feedback: feature requests and faults alike, sent from the app's Feedback screen.
-- Modelled on taiwan-expenses' bug_reports, plus a status the sender can read back.
-- Status is maintained outside the app (dashboard / service role) as work lands, so clients
-- get no update or delete policy: they can send feedback and read their own, nothing else.
create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  -- set null (not cascade) so feedback survives the sender's account being deleted.
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  description text not null check (length(trim(description)) > 0),
  app_version text,
  platform    text,
  os_version  text,
  status      text not null default 'open' check (status in ('open', 'planned', 'done')),
  created_at  timestamptz not null default now()
);
create index on public.feedback (user_id);

alter table public.feedback enable row level security;

-- Send as yourself only, and only as new: nobody sets the status from the app.
create policy "insert own feedback" on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'open');

-- Read back what you sent, with its status.
create policy "select own feedback" on public.feedback
  for select to authenticated
  using (user_id = auth.uid());
