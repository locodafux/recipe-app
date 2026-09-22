-- The app is English but `item` is the Filipino merge key, so the invitee's phone,
-- which never merged the dishes itself, needs the display text and the dishes to show.
alter table public.list_items
  add column label    text,
  add column dishes   text[] not null default '{}',
  add column position integer not null default 0; -- display order, so both phones list items alike

-- 7B "Cancel invite": a member can withdraw a pending invite while the list is active.
create policy "members cancel pending invites" on public.invites for delete to authenticated
  using (
    accepted_at is null
    and public.is_member(list_id)
    and exists (select 1 from public.lists where id = list_id and archived_at is null)
  );
