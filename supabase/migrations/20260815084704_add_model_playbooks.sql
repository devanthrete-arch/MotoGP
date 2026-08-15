-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084704_add_model_playbooks.

create table public.model_playbooks (
  id text primary key check (char_length(id) between 1 and 200),
  brand text not null check (char_length(brand) between 1 and 80),
  model text not null check (char_length(model) between 1 and 120),
  headline text not null default '' check (char_length(headline) <= 400),
  confidence text not null default 'Early signal'
    check (confidence in ('Early signal', 'Useful base', 'Strong pattern')),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  corroborations integer not null default 0 check (corroborations >= 0),
  owner_signals text[] not null default '{}',
  buyer_checks text[] not null default '{}',
  curated_by uuid references auth.users (id) on delete set null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, model)
);

comment on table public.model_playbooks is
  'Hosted ownership playbook per brand+model; id matches the local modelKeyFor(brand, model) slug.';

create table public.playbook_entries (
  id uuid primary key default gen_random_uuid(),
  playbook_id text not null references public.model_playbooks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_post_id text references public.owner_posts (id) on delete set null,
  kind text not null check (kind in ('Owner signal', 'Buyer check', 'Known issue', 'Fix', 'Cost note')),
  title text not null check (char_length(title) between 1 and 180),
  detail text not null default '' check (char_length(detail) <= 4000),
  evidence_count integer not null default 1 check (evidence_count >= 0),
  corroborations integer not null default 0 check (corroborations >= 0),
  confidence text not null default 'Early signal'
    check (confidence in ('Early signal', 'Useful base', 'Strong pattern')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.playbook_entries is
  'Individual evidence-scored line inside a model playbook (owner signals and buyer checks).';

create index model_playbooks_model_idx on public.model_playbooks (brand, model);
create index model_playbooks_confidence_idx on public.model_playbooks (confidence, evidence_count desc);
create index model_playbooks_curated_by_idx on public.model_playbooks (curated_by);
create index playbook_entries_playbook_id_idx on public.playbook_entries (playbook_id, kind, created_at desc);
create index playbook_entries_user_id_idx on public.playbook_entries (user_id, created_at desc);
create index playbook_entries_source_post_id_idx on public.playbook_entries (source_post_id);

alter table public.model_playbooks enable row level security;
alter table public.playbook_entries enable row level security;

revoke all on public.model_playbooks, public.playbook_entries from anon, authenticated;
grant select on public.model_playbooks, public.playbook_entries to anon;
grant select, insert, update, delete on public.model_playbooks, public.playbook_entries to authenticated;

create policy "Model playbooks are readable by everyone" on public.model_playbooks
for select to anon, authenticated using (true);
create policy "Signed-in users create model playbooks" on public.model_playbooks
for insert to authenticated with check ((select auth.uid()) = curated_by);
create policy "Curators update their model playbooks" on public.model_playbooks
for update to authenticated using ((select auth.uid()) = curated_by) with check ((select auth.uid()) = curated_by);
create policy "Curators delete their model playbooks" on public.model_playbooks
for delete to authenticated using ((select auth.uid()) = curated_by);

create policy "Playbook entries are readable by everyone" on public.playbook_entries
for select to anon, authenticated using (true);
create policy "Signed-in users create their own playbook entries" on public.playbook_entries
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Contributors update their own playbook entries" on public.playbook_entries
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Contributors delete their own playbook entries" on public.playbook_entries
for delete to authenticated using ((select auth.uid()) = user_id);

create trigger set_model_playbooks_updated_at before update on public.model_playbooks
for each row execute function public.set_autoflex_updated_at();

create trigger set_playbook_entries_updated_at before update on public.playbook_entries
for each row execute function public.set_autoflex_updated_at();
