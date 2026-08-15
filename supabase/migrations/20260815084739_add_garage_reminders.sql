-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084739_add_garage_reminders.

create table public.garage_reminders (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id text not null,
  kind text not null default 'Service'
    check (kind in ('Service', 'Insurance', 'Tyres', 'PUC', 'Fitness', 'Custom')),
  title text not null check (char_length(title) between 1 and 180),
  detail text not null default '' check (char_length(detail) <= 4000),
  urgency text not null default 'Plan' check (urgency in ('Soon', 'Plan', 'Watch')),
  due_date date,
  due_odometer_km integer check (due_odometer_km >= 0),
  status text not null default 'Open' check (status in ('Open', 'Snoozed', 'Done', 'Dismissed')),
  last_notified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles (id, user_id) on delete cascade
);

comment on table public.garage_reminders is
  'Hosted scheduling for the reminders buildGarageReminders() derives locally, so they survive across devices.';

create index garage_reminders_user_due_idx on public.garage_reminders (user_id, due_date);
create index garage_reminders_vehicle_id_idx on public.garage_reminders (vehicle_id, due_date);
create index garage_reminders_status_due_idx on public.garage_reminders (status, due_date);
create index garage_reminders_user_notified_idx on public.garage_reminders (user_id, last_notified_at desc);

alter table public.garage_reminders enable row level security;

revoke all on public.garage_reminders from anon, authenticated;
grant select, insert, update, delete on public.garage_reminders to authenticated;

create policy "Garage reminders are private to their owner" on public.garage_reminders
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_garage_reminders_updated_at before update on public.garage_reminders
for each row execute function public.set_autoflex_updated_at();
