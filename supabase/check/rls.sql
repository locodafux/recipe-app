-- Runs in one transaction and rolls back, so it is safe against a dev database.
-- Any failed assertion aborts psql with a non-zero exit.
begin;

create function pg_temp.login(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.eq(got anyelement, want anyelement, what text) returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL %: got %, want %', what, got, want;
  end if;
end $$;
create function pg_temp.fails(stmt text, want text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL expected "%" from: %', want, stmt;
exception when others then
  if sqlerrm like 'FAIL%' or sqlerrm not like '%' || want || '%' then
    raise;
  end if;
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'Bob@Example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.com');

-- Alice creates a list; she becomes its owner and can see it straight away.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into lists (id, name) values ('11111111-0000-0000-0000-000000000000', 'This week') returning id;
select pg_temp.eq((select role from list_members where user_id = auth.uid()), 'owner', 'creator is owner');
insert into list_items (id, list_id, item, qty, unit, aisle, checked) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000000', 'kangkong', 1, 'bunch', 'gulay', false),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000000', 'gabi', 250, 'g', 'gulay', false),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000000', 'patis', 2, 'tbsp', 'dry goods', false);
with i as (insert into invites (list_id, email) values ('11111111-0000-0000-0000-000000000000', 'bob@example.com') returning token)
select set_config('check.bob_token', (select token::text from i), true);
with i as (insert into invites (list_id, email) values ('11111111-0000-0000-0000-000000000000', 'carol@example.com') returning token)
select set_config('check.carol_token', (select token::text from i), true);

-- Eve is not a member: she sees nothing and changes nothing.
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.eq((select count(*) from lists), 0::bigint, 'eve sees lists');
select pg_temp.eq((select count(*) from list_items), 0::bigint, 'eve sees items');
select pg_temp.eq((select count(*) from list_members), 0::bigint, 'eve sees members');
select pg_temp.eq((select count(*) from invites), 0::bigint, 'eve sees invites');
with u as (update list_items set checked = true returning 1)
select pg_temp.eq((select count(*) from u), 0::bigint, 'eve ticks items');
with u as (update lists set name = 'mine' returning 1)
select pg_temp.eq((select count(*) from u), 0::bigint, 'eve renames list');
with d as (delete from list_items returning 1)
select pg_temp.eq((select count(*) from d), 0::bigint, 'eve deletes items');
select pg_temp.fails($$insert into list_items (list_id, item) values ('11111111-0000-0000-0000-000000000000', 'x')$$, 'row-level security');
select pg_temp.fails($$insert into list_members (list_id, user_id) values ('11111111-0000-0000-0000-000000000000', auth.uid())$$, 'row-level security');
select pg_temp.fails($$insert into invites (list_id, email) values ('11111111-0000-0000-0000-000000000000', 'eve@example.com')$$, 'row-level security');
select pg_temp.fails($$insert into lists (name, created_by) values ('forged', '00000000-0000-0000-0000-00000000000a')$$, 'row-level security');

-- Eve cannot use an invite addressed to someone else, nor a made-up token.
select pg_temp.fails($$select accept_invite(current_setting('check.bob_token')::uuid)$$, 'different email');
select pg_temp.fails($$select accept_invite(gen_random_uuid())$$, 'not found');
select pg_temp.eq((select count(*) from list_items), 0::bigint, 'eve sees items after failed accepts');

-- Anonymous callers cannot accept invites at all.
reset role;
select set_config('role', 'anon', true);
select pg_temp.fails($$select accept_invite(current_setting('check.bob_token')::uuid)$$, 'permission denied');

-- Bob accepts his invite (email matched case-insensitively); it is single-use.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.eq((select count(*) from list_items), 0::bigint, 'bob sees items before accepting');
select pg_temp.eq(accept_invite(current_setting('check.bob_token')::uuid), '11111111-0000-0000-0000-000000000000'::uuid, 'accept returns list');
select pg_temp.eq((select count(*) from list_items), 3::bigint, 'bob sees items after accepting');
select pg_temp.eq((select role from list_members where user_id = auth.uid()), 'member', 'invitee role');
select pg_temp.fails($$select accept_invite(current_setting('check.bob_token')::uuid)$$, 'already used');

-- Bob ticks kangkong first; checked_by/checked_at are set by the server, not the client.
update list_items set checked = true, checked_by = '00000000-0000-0000-0000-00000000000e'
where id = '22222222-0000-0000-0000-000000000001';
select pg_temp.eq((select checked_by from list_items where id = '22222222-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 'checked_by is the ticker');
select set_config('check.first_at', (select checked_at::text from list_items where id = '22222222-0000-0000-0000-000000000001'), true);
select pg_temp.eq(current_setting('check.first_at') <> '', true, 'checked_at set');

-- Alice's slower phone flushes an uncheck of her own earlier tick (the app scopes it by checked_by) and a
-- late tick: neither un-buys Bob's tick nor steals it.
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update list_items set checked = false where id = '22222222-0000-0000-0000-000000000001' and checked_by = auth.uid();
update list_items set checked = true, checked_at = now() + interval '1 hour' where id = '22222222-0000-0000-0000-000000000001';
update list_items set checked_by = null, checked_at = null where id = '22222222-0000-0000-0000-000000000001';
select pg_temp.eq((select row(checked, checked_by, checked_at::text)::text from list_items where id = '22222222-0000-0000-0000-000000000001'),
  row(true, '00000000-0000-0000-0000-00000000000b'::uuid, current_setting('check.first_at'))::text, 'first tick is kept');
-- D5 revised: a deliberate uncheck of the tick itself goes through and clears the checker; a new tick credits anew.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update list_items set checked = false where id = '22222222-0000-0000-0000-000000000001' and checked_by = auth.uid();
select pg_temp.eq((select row(checked, checked_by, checked_at)::text from list_items where id = '22222222-0000-0000-0000-000000000001'),
  row(false, null::uuid, null::timestamptz)::text, 'uncheck clears the tick');
update list_items set checked = true where id = '22222222-0000-0000-0000-000000000001';
select pg_temp.eq((select checked_by from list_items where id = '22222222-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-00000000000b'::uuid, 're-tick credits the ticker');
-- An unchecked item cannot carry a checker.
update list_items set checked_by = auth.uid(), checked_at = now() where id = '22222222-0000-0000-0000-000000000002';
select pg_temp.eq((select row(checked, checked_by, checked_at)::text from list_items where id = '22222222-0000-0000-0000-000000000002'),
  row(false, null::uuid, null::timestamptz)::text, 'unchecked item has no checker');
-- Items stay put.
select pg_temp.fails($$update list_items set list_id = gen_random_uuid() where id = '22222222-0000-0000-0000-000000000002'$$, 'cannot move');

-- A pending invite can be cancelled; an accepted one cannot, and outsiders cannot touch either.
with i as (insert into invites (list_id, email) values ('11111111-0000-0000-0000-000000000000', 'dan@example.com') returning token)
select set_config('check.dan_token', (select token::text from i), true);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
delete from invites;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.eq((select count(*) from invites), 3::bigint, 'eve cancels nothing');
delete from invites where email in ('dan@example.com', 'bob@example.com');
select pg_temp.eq((select string_agg(email, ',' order by email) from invites), 'bob@example.com,carol@example.com', 'only pending invite cancelled');

-- Alice archives the list: it and its items are now frozen history.
update lists set archived_at = now() where id = '11111111-0000-0000-0000-000000000000';
select pg_temp.fails($$update lists set archived_at = null$$, 'archived');
select pg_temp.fails($$update lists set name = 'renamed'$$, 'archived');
select pg_temp.fails($$update list_items set checked = true where id = '22222222-0000-0000-0000-000000000002'$$, 'archived');
select pg_temp.fails($$insert into list_items (list_id, item) values ('11111111-0000-0000-0000-000000000000', 'toyo')$$, 'archived');
select pg_temp.fails($$delete from list_items$$, 'archived');
select pg_temp.fails($$insert into invites (list_id, email) values ('11111111-0000-0000-0000-000000000000', 'dan@example.com')$$, 'row-level security');
select pg_temp.eq((select count(*) from list_items), 3::bigint, 'archived items kept');

-- History (M5) is readable by both members: Bob sees the archived trip and what was ticked on it.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.eq((select count(*) from lists where archived_at is not null), 1::bigint, 'member sees archived trip');
select pg_temp.eq((select string_agg(item, ',' order by item) from list_items where checked), 'kangkong', 'member sees what was bought');
select pg_temp.fails($$update lists set archived_at = now()$$, 'archived');

-- An invite still pending when the list was archived no longer works.
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'carol@example.com');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.fails($$select accept_invite(current_setting('check.carol_token')::uuid)$$, 'archived');

-- Feedback: sent as yourself, read back with its status; nobody reads anyone else's or sets a status.
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into feedback (description, app_version, platform, os_version) values ('Let me add my own dish', '1.1.0', 'android', '34');
select pg_temp.eq((select row(user_id, status)::text from feedback), row('00000000-0000-0000-0000-00000000000b'::uuid, 'open')::text, 'feedback is mine and open');
select pg_temp.fails($$insert into feedback (description) values ('  ')$$, 'check constraint');
select pg_temp.fails($$insert into feedback (description, user_id) values ('forged', '00000000-0000-0000-0000-00000000000a')$$, 'row-level security');
select pg_temp.fails($$insert into feedback (description, status) values ('already done?', 'done')$$, 'row-level security');
with u as (update feedback set status = 'done' returning 1)
select pg_temp.eq((select count(*) from u), 0::bigint, 'sender sets status');
with d as (delete from feedback returning 1)
select pg_temp.eq((select count(*) from d), 0::bigint, 'sender deletes feedback');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.eq((select count(*) from feedback), 0::bigint, 'eve sees others feedback');
reset role;
select set_config('role', 'anon', true);
select pg_temp.fails($$insert into feedback (description) values ('anon')$$, 'row-level security');
reset role;
update feedback set status = 'planned'; -- outside the app (dashboard, service role)
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.eq((select status from feedback), 'planned', 'sender reads status');

-- Deleting an account still cascades through archived lists (runs as the table owner, not an app user).
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.eq((select checked_by from list_items where id = '22222222-0000-0000-0000-000000000001'), null::uuid, 'checker deleted');
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.eq((select count(*) from list_items), 0::bigint, 'owner deleted cascades');
select pg_temp.eq((select row(count(*), max(user_id::text))::text from feedback), row(1::bigint, null::text)::text, 'feedback survives its sender');

-- Realtime broadcasts list_items.
select pg_temp.eq((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'list_items'), 1::bigint, 'list_items in realtime');

\echo 'ok: RLS isolation, ticks and unchecks, invites, archiving, history and feedback all hold'
rollback;
