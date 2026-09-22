-- Shared shopping lists (README section 4): two phones, one list, no signal.

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table public.list_members (
  id      uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role    text not null default 'member' check (role in ('owner', 'member')),
  unique (list_id, user_id)
);

create table public.list_items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  item       text not null,
  qty        numeric,
  unit       text,
  aisle      text,
  checked    boolean not null default false,
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz
);
create index on public.list_items (list_id);

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists (id) on delete cascade,
  email       text not null,
  token       uuid not null unique default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

-- Security definer so policies can ask "is the caller a member?" without
-- recursing through list_members' own RLS.
create function public.is_member(p_list_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;

-- The creator becomes the list's owner.
create function public.add_list_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.list_members (list_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger add_list_owner after insert on public.lists
  for each row execute function public.add_list_owner();

-- Archiving is one-way: an archived list is history and never changes again.
create function public.guard_list_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.archived_at is not null then
    raise exception 'list % is archived', old.id using errcode = 'check_violation';
  end if;
  new.created_by := old.created_by;
  return new;
end;
$$;
create trigger guard_list_update before update on public.lists
  for each row execute function public.guard_list_update();

-- Items of an archived list are frozen. On an active list `checked` is an OR:
-- it only ever goes false->true, and the first tick to reach the server keeps
-- checked_by/checked_at. A slower phone flushing a stale `checked = false`
-- is absorbed, not rejected, so its queue still drains. Undoing a tick (D5)
-- therefore only works on the phone, before the tick is flushed.
-- Like RLS, the guard binds app users only, so cascades from deleting an
-- account (which run as the table owner) and service_role still work.
create function public.guard_list_item() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_list_id uuid := case when tg_op = 'DELETE' then old.list_id else new.list_id end;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.lists where id = v_list_id and archived_at is not null) then
    raise exception 'list % is archived', v_list_id using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.list_id <> old.list_id then
      raise exception 'list items cannot move between lists' using errcode = 'check_violation';
    end if;
    if old.checked then
      new.checked := true;
      new.checked_by := old.checked_by;
      new.checked_at := old.checked_at;
      return new;
    end if;
  end if;
  if new.checked then
    new.checked_by := auth.uid();
    new.checked_at := now();
  else
    new.checked_by := null;
    new.checked_at := null;
  end if;
  return new;
end;
$$;
create trigger guard_list_item before insert or update or delete on public.list_items
  for each row execute function public.guard_list_item();

-- Row-level security: only a list's members see or change it.
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.list_items   enable row level security;
alter table public.invites      enable row level security;

-- created_by is in the select policy so `insert ... returning` works: the
-- owner row from add_list_owner does not exist yet when RETURNING is checked.
create policy "members read lists" on public.lists for select to authenticated
  using (created_by = auth.uid() or public.is_member(id));
create policy "users create lists" on public.lists for insert to authenticated
  with check (created_by = auth.uid());
create policy "members update lists" on public.lists for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- Membership is only ever written by add_list_owner and accept_invite.
create policy "members read members" on public.list_members for select to authenticated
  using (public.is_member(list_id));

create policy "members read items" on public.list_items for select to authenticated
  using (public.is_member(list_id));
create policy "members add items" on public.list_items for insert to authenticated
  with check (public.is_member(list_id));
create policy "members update items" on public.list_items for update to authenticated
  using (public.is_member(list_id)) with check (public.is_member(list_id));
create policy "members delete items" on public.list_items for delete to authenticated
  using (public.is_member(list_id));

create policy "members read invites" on public.invites for select to authenticated
  using (public.is_member(list_id));
create policy "members invite to active lists" on public.invites for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_member(list_id)
    and exists (select 1 from public.lists where id = list_id and archived_at is null)
  );

-- Magic-link invite, second half. The inviter inserts an invite, then sends
-- the invitee a magic link (supabase.auth.signInWithOtp) whose redirect
-- carries the token. Once signed in, the invitee's app calls this. The token
-- is single-use and only works for the email it was sent to.
create function public.accept_invite(p_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.invites;
begin
  if v_uid is null then
    raise exception 'sign in to accept an invite' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.invites
  where token = p_token and accepted_at is null
  for update;
  if not found then
    raise exception 'invite not found or already used' using errcode = 'no_data_found';
  end if;

  if lower(v_invite.email) is distinct from (select lower(email) from auth.users where id = v_uid) then
    raise exception 'invite was sent to a different email' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.lists where id = v_invite.list_id and archived_at is not null) then
    raise exception 'list % is archived', v_invite.list_id using errcode = 'check_violation';
  end if;

  insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_uid)
  on conflict (list_id, user_id) do nothing;
  update public.invites set accepted_at = now(), accepted_by = v_uid where id = v_invite.id;
  return v_invite.list_id;
end;
$$;
revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Realtime pushes the other phone's ticks (RLS still applies to who receives them).
alter publication supabase_realtime add table public.list_items;
