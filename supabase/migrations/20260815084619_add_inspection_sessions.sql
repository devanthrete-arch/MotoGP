-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084619_add_inspection_sessions.

create table public.inspection_sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  shortlist_item_id text references public.shortlist_items (id) on delete set null,
  brand text not null check (char_length(brand) between 1 and 80),
  model text not null check (char_length(model) between 1 and 120),
  variant text not null default '' check (char_length(variant) <= 160),
  city text not null default '' check (char_length(city) <= 100),
  odometer_km integer not null default 0 check (odometer_km >= 0),
  status text not null default 'In progress'
    check (status in ('In progress', 'Completed', 'Abandoned')),
  verdict text not null default ''
    check (verdict in ('', 'Buy', 'Negotiate', 'Needs recheck', 'Walk away')),
  notes text not null default '' check (char_length(notes) <= 4000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

comment on table public.inspection_sessions is
  'Buyer inspection run for a shortlisted model; mirrors the local InspectionChecklist wrapper.';

create table public.inspection_items (
  id text primary key,
  session_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_item_id text not null check (char_length(checklist_item_id) between 1 and 160),
  title text not null check (char_length(title) between 1 and 180),
  detail text not null default '' check (char_length(detail) <= 2000),
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  state text not null default 'Pending' check (state in ('Pending', 'Pass', 'Fail', 'Skipped')),
  note text not null default '' check (char_length(note) <= 4000),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, checklist_item_id),
  foreign key (session_id, user_id) references public.inspection_sessions (id, user_id) on delete cascade
);

comment on table public.inspection_items is
  'Saved outcome for one InspectionChecklistItem inside an inspection session.';

create index inspection_sessions_user_id_idx on public.inspection_sessions (user_id, updated_at desc);
create index inspection_sessions_shortlist_item_id_idx on public.inspection_sessions (shortlist_item_id);
create index inspection_sessions_model_idx on public.inspection_sessions (brand, model);
create index inspection_sessions_completed_at_idx on public.inspection_sessions (user_id, completed_at desc);
create index inspection_items_session_id_idx on public.inspection_items (session_id, priority);
create index inspection_items_user_id_idx on public.inspection_items (user_id, updated_at desc);

alter table public.inspection_sessions enable row level security;
alter table public.inspection_items enable row level security;

revoke all on public.inspection_sessions, public.inspection_items from anon, authenticated;
grant select, insert, update, delete on public.inspection_sessions, public.inspection_items to authenticated;

create policy "Inspection sessions are private to their owner" on public.inspection_sessions
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Inspection items are private to their owner" on public.inspection_items
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_inspection_sessions_updated_at before update on public.inspection_sessions
for each row execute function public.set_autoflex_updated_at();

create trigger set_inspection_items_updated_at before update on public.inspection_items
for each row execute function public.set_autoflex_updated_at();
