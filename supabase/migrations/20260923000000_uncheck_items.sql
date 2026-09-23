-- D5 revised: a tick can be unchecked after it reached the server, not only
-- while it is queued on the phone. The `checked` column already holds that;
-- only guard_list_item stood in the way, silently keeping a ticked item at
-- true. Now `checked = false` on a ticked item unchecks it and clears
-- checked_by/checked_at. A tick of an already-ticked item still keeps the
-- first ticker's checked_by/checked_at.
--
-- The app only ever sends `checked = false` for a deliberate tap, and scopes
-- it to the tick that was tapped (`checked_by` in the filter), so a phone that
-- was offline cannot un-buy what the other person bought since (README 4).
create or replace function public.guard_list_item() returns trigger
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
    if old.checked and new.checked then
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
