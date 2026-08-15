-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084641_add_city_circles.

create table public.city_circles (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  city text not null check (char_length(city) between 1 and 100),
  state text not null default '' check (char_length(state) <= 100),
  headline text not null default '' check (char_length(headline) <= 180),
  summary text not null default '' check (char_length(summary) <= 4000),
  local_signal text not null default 'Quiet' check (local_signal in ('Quiet', 'Active', 'Hot')),
  top_brands text[] not null default '{}',
  hot_topics text[] not null default '{}',
  post_count integer not null default 0 check (post_count >= 0),
  garage_count integer not null default 0 check (garage_count >= 0),
  curated_by uuid references auth.users (id) on delete set null,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.city_circles is
  'Hosted city page built from the local buildCityCircles() shape; publicly readable, curator-writable.';

create table public.city_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  city_slug text not null references public.city_circles (slug) on delete cascade,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, city_slug)
);

comment on table public.city_follows is
  'Per-user follow of a hosted city circle; extends the local follows models/topics arrays.';

create index city_circles_city_idx on public.city_circles (city);
create index city_circles_signal_idx on public.city_circles (local_signal, post_count desc);
create index city_circles_curated_by_idx on public.city_circles (curated_by);
create index city_follows_user_id_idx on public.city_follows (user_id, created_at desc);
create index city_follows_city_slug_idx on public.city_follows (city_slug);

alter table public.city_circles enable row level security;
alter table public.city_follows enable row level security;

revoke all on public.city_circles, public.city_follows from anon, authenticated;
grant select on public.city_circles to anon;
grant select, insert, update, delete on public.city_circles, public.city_follows to authenticated;

create policy "City circles are readable by everyone" on public.city_circles
for select to anon, authenticated using (true);
create policy "Signed-in users create city circles" on public.city_circles
for insert to authenticated with check ((select auth.uid()) = curated_by);
create policy "Curators update their city circles" on public.city_circles
for update to authenticated using ((select auth.uid()) = curated_by) with check ((select auth.uid()) = curated_by);
create policy "Curators delete their city circles" on public.city_circles
for delete to authenticated using ((select auth.uid()) = curated_by);

create policy "City follows are private to their owner" on public.city_follows
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_city_circles_updated_at before update on public.city_circles
for each row execute function public.set_autoflex_updated_at();

create trigger set_city_follows_updated_at before update on public.city_follows
for each row execute function public.set_autoflex_updated_at();
