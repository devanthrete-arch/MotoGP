-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084753_add_garage_costs.

create table public.garage_costs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id text not null,
  timeline_entry_id text references public.timeline_entries (id) on delete set null,
  category text not null
    check (category in ('Service', 'Repair', 'Tyres', 'Insurance', 'Fuel', 'Trip', 'Accessories', 'Tax', 'Other')),
  title text not null default '' check (char_length(title) <= 180),
  amount_inr numeric(12, 2) not null default 0 check (amount_inr >= 0),
  odometer_km integer not null default 0 check (odometer_km >= 0),
  incurred_on date not null,
  note text not null default '' check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles (id, user_id) on delete cascade
);

comment on table public.garage_costs is
  'Running-cost ledger rows behind GarageCostLedger analytics; timeline_entry_id links back to the owning note.';

create index garage_costs_user_incurred_idx on public.garage_costs (user_id, incurred_on desc);
create index garage_costs_vehicle_incurred_idx on public.garage_costs (vehicle_id, incurred_on desc);
create index garage_costs_user_category_idx on public.garage_costs (user_id, category, incurred_on desc);
create index garage_costs_timeline_entry_id_idx on public.garage_costs (timeline_entry_id);

alter table public.garage_costs enable row level security;

revoke all on public.garage_costs from anon, authenticated;
grant select, insert, update, delete on public.garage_costs to authenticated;

create policy "Garage costs are private to their owner" on public.garage_costs
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_garage_costs_updated_at before update on public.garage_costs
for each row execute function public.set_autoflex_updated_at();
