-- Isolated private snapshots. Apply through the normal migration process only.
create table public.otofolks_private_workspaces (
  user_id text primary key check (user_id ~ '^user_[A-Za-z0-9_-]+$'),
  payload jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint private_workspace_size check (pg_catalog.octet_length(payload::text) <= 1000000)
);

alter table public.otofolks_private_workspaces enable row level security;
revoke all on public.otofolks_private_workspaces from public, anon, authenticated, service_role;
grant select on public.otofolks_private_workspaces to authenticated;

create policy private_workspace_owner_select
on public.otofolks_private_workspaces for select to authenticated
using (user_id = (select auth.jwt() ->> 'sub'));

create function public.save_otofolks_private_workspace(p_payload jsonb, p_expected_revision bigint)
returns table (payload jsonb, revision bigint, updated_at timestamptz, user_id text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
  v_owner text := v_claims ->> 'sub';
  v_section text;
  v_item jsonb;
  v_key text;
  v_required text[];
  v_optional text[];
  v_numbers text[];
  v_value text;
  v_date date;
  v_row public.otofolks_private_workspaces%rowtype;
begin
  -- Supabase verifies the JWT before exposing claims; never accept a caller owner ID.
  if (v_claims ->> 'role') is distinct from 'authenticated'
     or v_owner is null or v_owner !~ '^user_[A-Za-z0-9_-]+$' then
    raise exception using errcode = '42501', message = 'An authenticated Clerk user_ subject is required';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'Expected revision must be a nonnegative bigint';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or pg_catalog.octet_length(p_payload::text) > 1000000 then
    raise exception using errcode = '22023', message = 'Workspace must be a JSON object of at most 1000000 bytes';
  end if;
  if not (p_payload ?& array['version','profile','garage','timeline','shortlist','follows','saved'])
     or p_payload - array['version','profile','garage','timeline','shortlist','follows','saved'] <> '{}'::jsonb
     or (p_payload -> 'version') is distinct from '1'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'profile') <> 'object'
     or pg_catalog.jsonb_typeof(p_payload -> 'follows') <> 'object' then
    raise exception using errcode = '22023', message = 'Workspace requires exactly the version 1 private snapshot keys';
  end if;
  foreach v_section in array array['garage','timeline','shortlist','saved'] loop
    if pg_catalog.jsonb_typeof(p_payload -> v_section) <> 'array' then
      raise exception using errcode = '22023', message = v_section || ' must be an array';
    end if;
  end loop;

  if not ((p_payload -> 'follows') ?& array['models','topics'])
     or (p_payload -> 'follows') - array['models','topics'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Follows requires exactly models and topics';
  end if;
  foreach v_section in array array['models','topics','saved'] loop
    v_item := case when v_section = 'saved' then p_payload -> 'saved'
                   else p_payload -> 'follows' -> v_section end;
    if pg_catalog.jsonb_typeof(v_item) <> 'array' then
      raise exception using errcode = '22023', message = v_section || ' must be an array';
    end if;
    for v_item in select e.value from pg_catalog.jsonb_array_elements(v_item) as e loop
      if pg_catalog.jsonb_typeof(v_item) <> 'string'
         or pg_catalog.length(v_item #>> '{}') > (case when v_section = 'saved' then 250 else 500 end)
         or (v_section = 'saved' and pg_catalog.btrim(v_item #>> '{}') = '') then
        raise exception using errcode = '22023', message = v_section || ' entries must be bounded strings (saved IDs must be nonempty)';
      end if;
    end loop;
  end loop;

  foreach v_section in array array['profile','garage','timeline','shortlist'] loop
    v_optional := array[]::text[];
    v_numbers := array[]::text[];
    case v_section
      when 'profile' then
        v_required := array['displayName','city','garageRole'];
      when 'garage' then
        v_required := array['id','nickname','brand','model','variant','city','odometerKm','purchaseMonth'];
        v_numbers := array['odometerKm'];
      when 'timeline' then
        v_required := array['id','vehicleId','kind','title','amount','odometerKm','happenedOn','note'];
        v_numbers := array['amount','odometerKm'];
      when 'shortlist' then
        v_required := array['id','brand','model','budget','status','notes'];
        v_optional := array['priceSource','state','variant'];
        v_numbers := array['budget'];
    end case;
    for v_item in
      select e.value from pg_catalog.jsonb_array_elements(
        case when v_section = 'profile' then pg_catalog.jsonb_build_array(p_payload -> 'profile')
             else p_payload -> v_section end) as e
    loop
      if pg_catalog.jsonb_typeof(v_item) <> 'object' then
        raise exception using errcode = '22023', message = v_section || ' entries must be objects';
      end if;
      if not (v_item ?& v_required) or v_item - (v_required || v_optional) <> '{}'::jsonb then
        raise exception using errcode = '22023', message = v_section || ' contains missing or unknown fields';
      end if;
      foreach v_key in array v_required || v_optional loop
        if not (v_item ? v_key) then continue; end if;
        v_value := v_item ->> v_key;
        if v_key = any(v_numbers) then
          if pg_catalog.jsonb_typeof(v_item -> v_key) <> 'number' then
            raise exception using errcode = '22023', message = v_section || '.' || v_key || ' must be a number';
          end if;
          if v_value::numeric < 0 or v_value::numeric > 1000000000000 then
            raise exception using errcode = '22023', message = v_section || '.' || v_key || ' must be between 0 and 1000000000000';
          end if;
        else
          if pg_catalog.jsonb_typeof(v_item -> v_key) <> 'string'
             or pg_catalog.length(v_value) > (case when v_key in ('note','notes') then 10000
                                                   when v_key in ('id','vehicleId') then 250 else 500 end)
             or (v_key in ('id','vehicleId') and pg_catalog.btrim(v_value) = '') then
            raise exception using errcode = '22023', message = v_section || '.' || v_key || ' must be a bounded string';
          end if;
        end if;
      end loop;
      if (v_section = 'profile' and v_item ->> 'garageRole' not in ('Owner','Buyer','Enthusiast','Mechanic'))
         or (v_section = 'timeline' and v_item ->> 'kind' not in ('Service','Repair','Tyres','Insurance','Fuel','Trip','Note'))
         or (v_section = 'shortlist' and v_item ->> 'status' not in ('New','Test drive')) then
        raise exception using errcode = '22023', message = v_section || ' contains an invalid enum value';
      end if;
      -- Purchase month may be empty; timeline dates must be real ISO dates.
      v_value := case v_section when 'garage' then v_item ->> 'purchaseMonth'
                               when 'timeline' then v_item ->> 'happenedOn' end;
      if v_section = 'timeline' and v_value = '' then
        raise exception using errcode = '22023', message = 'Timeline requires a calendar date';
      end if;
      if v_value is not null and v_value <> '' then
        if (v_section = 'garage' and v_value !~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
           or (v_section = 'timeline' and v_value !~ '^[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{2}$') then
          raise exception using errcode = '22023', message = v_section || ' requires an ISO date';
        end if;
        begin
          v_date := (v_value || case when v_section = 'garage' then '-01' else '' end)::date;
        exception when datetime_field_overflow or invalid_datetime_format then
          raise exception using errcode = '22023', message = v_section || ' contains an invalid calendar date';
        end;
      end if;
    end loop;
  end loop;

  -- Each statement takes the row/unique-index lock; no read-then-write race.
  if p_expected_revision = 0 then
    insert into public.otofolks_private_workspaces as w (user_id, payload, revision)
    values (v_owner, p_payload, 1)
    on conflict on constraint otofolks_private_workspaces_pkey do nothing
    returning w.* into v_row;
  else
    update public.otofolks_private_workspaces as w
    set payload = p_payload, revision = w.revision + 1, updated_at = pg_catalog.clock_timestamp()
    where w.user_id = v_owner and w.revision = p_expected_revision
    returning w.* into v_row;
  end if;
  if not found then
    raise exception using errcode = '40001',
      message = pg_catalog.format('Private workspace revision conflict (expected %s); reload before saving', p_expected_revision);
  end if;
  return query select v_row.payload, v_row.revision, v_row.updated_at, v_row.user_id;
end;
$$;

revoke all on function public.save_otofolks_private_workspace(jsonb, bigint) from public, anon, authenticated, service_role;
grant execute on function public.save_otofolks_private_workspace(jsonb, bigint) to authenticated;
