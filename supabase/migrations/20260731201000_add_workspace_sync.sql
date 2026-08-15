alter table public.garage_vehicles add column deleted_at timestamptz;
alter table public.timeline_entries add column deleted_at timestamptz;
alter table public.shortlist_items add column deleted_at timestamptz;

create function public.sync_autoflex_workspace(payload jsonb)
returns timestamptz
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  synced_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.autoflex_user_backups (
    user_id,
    schema_version,
    payload,
    client_updated_at
  )
  values (
    current_user_id,
    coalesce((payload ->> 'version')::smallint, 1),
    payload,
    coalesce((payload ->> 'exportedAt')::timestamptz, synced_at)
  )
  on conflict (user_id) do update set
    schema_version = excluded.schema_version,
    payload = excluded.payload,
    client_updated_at = excluded.client_updated_at;

  insert into public.profiles (user_id, display_name, city, garage_role)
  values (
    current_user_id,
    coalesce(payload #>> '{data,profile,displayName}', ''),
    coalesce(payload #>> '{data,profile,city}', ''),
    coalesce(payload #>> '{data,profile,garageRole}', 'Owner')
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    city = excluded.city,
    garage_role = excluded.garage_role;

  update public.timeline_entries set deleted_at = synced_at where user_id = current_user_id and deleted_at is null;
  update public.garage_vehicles set deleted_at = synced_at where user_id = current_user_id and deleted_at is null;

  insert into public.garage_vehicles (
    id, user_id, nickname, brand, model, variant, city, odometer_km, purchase_month, deleted_at
  )
  select
    item ->> 'id',
    current_user_id,
    coalesce(item ->> 'nickname', ''),
    item ->> 'brand',
    item ->> 'model',
    coalesce(item ->> 'variant', ''),
    coalesce(item ->> 'city', ''),
    coalesce((item ->> 'odometerKm')::integer, 0),
    coalesce(item ->> 'purchaseMonth', ''),
    null
  from jsonb_array_elements(coalesce(payload #> '{data,garage}', '[]'::jsonb)) as item
  on conflict (id) do update set
    nickname = excluded.nickname,
    brand = excluded.brand,
    model = excluded.model,
    variant = excluded.variant,
    city = excluded.city,
    odometer_km = excluded.odometer_km,
    purchase_month = excluded.purchase_month,
    deleted_at = null;

  insert into public.timeline_entries (
    id, user_id, vehicle_id, kind, title, amount, odometer_km, happened_on, note, deleted_at
  )
  select
    item ->> 'id',
    current_user_id,
    item ->> 'vehicleId',
    item ->> 'kind',
    item ->> 'title',
    coalesce((item ->> 'amount')::numeric, 0),
    coalesce((item ->> 'odometerKm')::integer, 0),
    (item ->> 'happenedOn')::date,
    coalesce(item ->> 'note', ''),
    null
  from jsonb_array_elements(coalesce(payload #> '{data,timeline}', '[]'::jsonb)) as item
  on conflict (id) do update set
    vehicle_id = excluded.vehicle_id,
    kind = excluded.kind,
    title = excluded.title,
    amount = excluded.amount,
    odometer_km = excluded.odometer_km,
    happened_on = excluded.happened_on,
    note = excluded.note,
    deleted_at = null;

  update public.shortlist_items set deleted_at = synced_at where user_id = current_user_id and deleted_at is null;
  insert into public.shortlist_items (id, user_id, brand, model, budget, status, notes, deleted_at)
  select
    item ->> 'id',
    current_user_id,
    item ->> 'brand',
    item ->> 'model',
    coalesce((item ->> 'budget')::numeric, 0),
    coalesce(item ->> 'status', 'Researching'),
    coalesce(item ->> 'notes', ''),
    null
  from jsonb_array_elements(coalesce(payload #> '{data,shortlist}', '[]'::jsonb)) as item
  on conflict (id) do update set
    brand = excluded.brand,
    model = excluded.model,
    budget = excluded.budget,
    status = excluded.status,
    notes = excluded.notes,
    deleted_at = null;

  insert into public.follows (user_id, models, topics)
  values (
    current_user_id,
    array(select jsonb_array_elements_text(coalesce(payload #> '{data,follows,models}', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(payload #> '{data,follows,topics}', '[]'::jsonb)))
  )
  on conflict (user_id) do update set models = excluded.models, topics = excluded.topics;

  insert into public.subscription_settings (user_id, email_digest, browser_alerts, quiet_hours)
  values (
    current_user_id,
    coalesce((payload #>> '{data,subscriptionSettings,emailDigest}')::boolean, true),
    coalesce((payload #>> '{data,subscriptionSettings,browserAlerts}')::boolean, false),
    coalesce((payload #>> '{data,subscriptionSettings,quietHours}')::boolean, true)
  )
  on conflict (user_id) do update set
    email_digest = excluded.email_digest,
    browser_alerts = excluded.browser_alerts,
    quiet_hours = excluded.quiet_hours;

  return synced_at;
end;
$$;

revoke all on function public.sync_autoflex_workspace(jsonb) from public, anon;
grant execute on function public.sync_autoflex_workspace(jsonb) to authenticated;
