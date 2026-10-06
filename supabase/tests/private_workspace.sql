-- Run only against a disposable Supabase test DB with the migration already installed.
-- Example: psql -v ON_ERROR_STOP=1 "$TEST_DATABASE_URL" -f supabase/tests/private_workspace.sql
-- No migration is applied here. All fixtures and helpers roll back.
begin;

create function pg_temp.check_true(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'Expected %, got %: %', expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, but statement succeeded: %', expected_state, statement;
end;
$$;

create function pg_temp.fixture() returns jsonb language sql as $$
  select '{"version":1,"profile":{"displayName":"Test","city":"Pune","garageRole":"Owner"},
    "garage":[{"id":"g1","nickname":"Daily","brand":"Tata","model":"Nexon","variant":"","city":"Pune","odometerKm":1200,"purchaseMonth":"2024-02"}],
    "timeline":[{"id":"t1","vehicleId":"g1","kind":"Service","title":"Service","amount":123.45,"odometerKm":1200,"happenedOn":"2024-02-29","note":""}],
    "shortlist":[{"id":"s1","brand":"Tata","model":"Nexon","budget":1000000,"status":"New","notes":"","variant":"","state":"","priceSource":""}],
    "follows":{"models":["tata-nexon"],"topics":["Service"]},"saved":["post-reference"]}'::jsonb;
$$;

select pg_catalog.set_config('test.workspace_a', 'user_workspace_test_a_' || pg_catalog.txid_current()::text, true);
select pg_catalog.set_config('test.workspace_b', 'user_workspace_test_b_' || pg_catalog.txid_current()::text, true);
select pg_temp.check_true(not exists (
  select 1 from public.otofolks_private_workspaces
  where user_id in (pg_catalog.current_setting('test.workspace_a'), pg_catalog.current_setting('test.workspace_b'))
), 'fresh fixture subjects');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'role', 'authenticated', 'sub', pg_catalog.current_setting('test.workspace_a'))::text, true);
select pg_temp.check_true(count(*) = 0, 'A initially empty') from public.otofolks_private_workspaces;
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), 1)', '40001');
select pg_temp.check_true(revision = 1 and payload = pg_temp.fixture() and updated_at is not null
  and user_id = pg_catalog.current_setting('test.workspace_a'), 'A create returns full row')
from public.save_otofolks_private_workspace(pg_temp.fixture(), 0);
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), 0)', '40001');
select pg_temp.check_true(revision = 2 and payload -> 'saved' = '[]'::jsonb, 'matching update increments')
from public.save_otofolks_private_workspace(pg_catalog.jsonb_set(pg_temp.fixture(), '{saved}', '[]'), 1);
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), 1)', '40001');
select pg_temp.check_true(count(*) = 1 and min(revision) = 2 and bool_and(payload -> 'saved' = '[]'::jsonb),
  'conflicts leave A unchanged') from public.otofolks_private_workspaces;

select pg_temp.expect_error($q$insert into public.otofolks_private_workspaces(user_id,payload,revision)
  values (current_setting('test.workspace_a'), pg_temp.fixture(), 1)$q$, '42501');
select pg_temp.expect_error('update public.otofolks_private_workspaces set revision = 99', '42501');
select pg_temp.expect_error('delete from public.otofolks_private_workspaces', '42501');
select pg_temp.expect_error('truncate public.otofolks_private_workspaces', '42501');

select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'role', 'authenticated', 'sub', pg_catalog.current_setting('test.workspace_b'))::text, true);
select pg_temp.check_true(count(*) = 0, 'B cannot read A') from public.otofolks_private_workspaces;
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), 2)', '40001');
select pg_temp.check_true(revision = 1 and user_id = pg_catalog.current_setting('test.workspace_b'), 'B has its own revision')
from public.save_otofolks_private_workspace(pg_temp.fixture(), 0);
select pg_temp.check_true(count(*) = 1 and bool_and(user_id = pg_catalog.current_setting('test.workspace_b')),
  'B sees only B') from public.otofolks_private_workspaces;

-- Exercise every required root key/type and nested field/type; failures must not advance revision.
do $$
declare
  base jsonb := pg_temp.fixture();
  bad jsonb;
  section text;
  field text;
  path text[];
begin
  foreach bad in array array[null::jsonb, 'null'::jsonb, '[]'::jsonb, 'true'::jsonb,
    base || '{"version":"1"}', base || '{"version":2}', base || '{"posts":[]}',
    base || '{"reports":[]}', base || '{"moderator":true}', base || '{"user_id":"user_other"}',
    pg_catalog.jsonb_set(base, '{profile,displayName}', pg_catalog.to_jsonb(pg_catalog.repeat('x',501))),
    pg_catalog.jsonb_set(base, '{timeline,0,note}', pg_catalog.to_jsonb(pg_catalog.repeat('x',1048577))),
    pg_catalog.jsonb_set(base, '{garage,0,odometerKm}', '-1'),
    pg_catalog.jsonb_set(base, '{shortlist,0,budget}', '1000000000001'),
    pg_catalog.jsonb_set(base, '{garage,0,purchaseMonth}', '"2024-13"'),
    pg_catalog.jsonb_set(base, '{timeline,0,happenedOn}', '"2025-02-29"'),
    pg_catalog.jsonb_set(base, '{profile,garageRole}', '"Admin"'),
    pg_catalog.jsonb_set(base, '{timeline,0,kind}', '"Other"'),
    pg_catalog.jsonb_set(base, '{shortlist,0,status}', '"Other"'),
    pg_catalog.jsonb_set(base, '{saved}', '[1]'),
    pg_catalog.jsonb_set(base, '{follows,models}', '[false]'),
    pg_catalog.jsonb_set(base, '{saved}', '[""]'),
    pg_catalog.jsonb_set(base, '{timeline,0,happenedOn}', '""'),
    pg_catalog.jsonb_set(base, '{follows}', '{"models":[],"topics":[],"posts":[]}')]
  loop
    perform pg_temp.expect_error(pg_catalog.format(
      'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)', bad), '22023');
  end loop;
  for section in select pg_catalog.jsonb_object_keys(base) loop
    perform pg_temp.expect_error(pg_catalog.format(
      'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)', base - section), '22023');
    perform pg_temp.expect_error(pg_catalog.format(
      'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)',
      pg_catalog.jsonb_set(base, array[section], 'null')), '22023');
  end loop;
  foreach section in array array['profile','garage','timeline','shortlist','follows'] loop
    path := case when section in ('profile','follows') then array[section] else array[section,'0'] end;
    perform pg_temp.expect_error(pg_catalog.format(
      'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)',
      pg_catalog.jsonb_set(base, path, (base #> path) || '{"reports":[]}')), '22023');
    for field in select pg_catalog.jsonb_object_keys(base #> path) loop
      if field not in ('priceSource','state','variant') or section <> 'shortlist' then
        perform pg_temp.expect_error(pg_catalog.format(
          'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)', base #- (path || field)), '22023');
      end if;
      perform pg_temp.expect_error(pg_catalog.format(
        'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)',
        pg_catalog.jsonb_set(base, path || field, 'true')), '22023');
      perform pg_temp.expect_error(pg_catalog.format(
        'select * from public.save_otofolks_private_workspace(%L::jsonb, 1)',
        pg_catalog.jsonb_set(base, path || field, 'null')), '22023');
    end loop;
  end loop;
end;
$$;
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), null)', '22023');
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), -1)', '22023');
select pg_temp.check_true(count(*) = 1 and min(revision) = 1 and bool_and(payload = pg_temp.fixture()),
  'malformed requests leave B unchanged') from public.otofolks_private_workspaces;

-- The RPC independently rejects invalid claims, even when invoked as authenticated.
do $$
declare claims jsonb;
begin
  foreach claims in array array['{}'::jsonb, '{"role":"authenticated"}',
    '{"role":"authenticated","sub":""}', '{"role":"authenticated","sub":"user_"}',
    '{"role":"authenticated","sub":"other"}', '{"role":"anon","sub":"user_test"}',
    '{"role":"service_role","sub":"user_test"}'] loop
    perform pg_catalog.set_config('request.jwt.claims', claims::text, true);
    perform pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), 0)', '42501');
  end loop;
end;
$$;

set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect_error('select * from public.otofolks_private_workspaces', '42501');
select pg_temp.expect_error('select * from public.save_otofolks_private_workspace(pg_temp.fixture(), 0)', '42501');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'role', 'authenticated', 'sub', pg_catalog.current_setting('test.workspace_a'))::text, true);
select pg_temp.check_true(count(*) = 1 and min(revision) = 2
  and bool_and(user_id = pg_catalog.current_setting('test.workspace_a')),
  'A remains isolated after B writes and rejected requests') from public.otofolks_private_workspaces;

reset role;
rollback;
