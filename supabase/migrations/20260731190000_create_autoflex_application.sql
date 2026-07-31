create function public.set_autoflex_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_autoflex_updated_at() from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  city text not null default '' check (char_length(city) <= 100),
  garage_role text not null default 'Owner'
    check (garage_role in ('Owner', 'Buyer', 'Enthusiast', 'Mechanic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.garage_vehicles (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null default '' check (char_length(nickname) <= 100),
  brand text not null check (char_length(brand) between 1 and 80),
  model text not null check (char_length(model) between 1 and 120),
  variant text not null default '' check (char_length(variant) <= 160),
  city text not null default '' check (char_length(city) <= 100),
  odometer_km integer not null default 0 check (odometer_km >= 0),
  purchase_month text not null default '' check (purchase_month = '' or purchase_month ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.timeline_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  vehicle_id text not null,
  kind text not null check (kind in ('Service', 'Repair', 'Tyres', 'Insurance', 'Fuel', 'Trip', 'Note')),
  title text not null check (char_length(title) between 1 and 180),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  odometer_km integer not null default 0 check (odometer_km >= 0),
  happened_on date not null,
  note text not null default '' check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles (id, user_id) on delete cascade
);

create table public.shortlist_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 80),
  model text not null check (char_length(model) between 1 and 120),
  budget numeric(14, 2) not null default 0 check (budget >= 0),
  status text not null default 'Researching'
    check (status in ('Researching', 'Test drive', 'Negotiating', 'Rejected', 'Bought')),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follows (
  user_id uuid primary key references auth.users (id) on delete cascade,
  models text[] not null default '{}',
  topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_digest boolean not null default true,
  browser_alerts boolean not null default false,
  quiet_hours boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owner_posts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  author text not null check (char_length(author) between 1 and 80),
  brand text not null check (char_length(brand) between 1 and 80),
  model text not null check (char_length(model) between 1 and 120),
  variant text not null default '' check (char_length(variant) <= 160),
  city text not null default '' check (char_length(city) <= 100),
  odometer_km integer not null default 0 check (odometer_km >= 0),
  label text not null check (label in ('Review', 'Known issue', 'Fix', 'Cost note', 'Travelogue', 'Owner note')),
  topic text not null check (char_length(topic) between 1 and 120),
  body text not null check (char_length(body) between 1 and 12000),
  helpful integer not null default 0 check (helpful >= 0),
  fixes_confirmed integer not null default 0 check (fixes_confirmed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.owner_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author text not null check (char_length(author) between 1 and 80),
  message text not null check (char_length(message) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_posts (
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id text not null references public.owner_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.reports (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  post_id text not null references public.owner_posts (id) on delete cascade,
  post_title text not null check (char_length(post_title) between 1 and 180),
  reason text not null check (char_length(reason) between 1 and 3000),
  reporter_name text not null check (char_length(reporter_name) between 1 and 80),
  status text not null default 'Open' check (status in ('Open', 'Dismissed', 'Removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.autoflex_user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.autoflex_user_backups is
  'Versioned recovery snapshot for local-first import and disaster recovery; normalized tables remain authoritative.';

create index garage_vehicles_user_id_idx on public.garage_vehicles (user_id);
create index timeline_entries_user_vehicle_idx on public.timeline_entries (user_id, vehicle_id, happened_on desc);
create index shortlist_items_user_id_idx on public.shortlist_items (user_id, updated_at desc);
create index owner_posts_created_at_idx on public.owner_posts (created_at desc);
create index owner_posts_model_idx on public.owner_posts (brand, model);
create index post_comments_post_id_idx on public.post_comments (post_id, created_at);
create index reports_user_id_idx on public.reports (user_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'garage_vehicles', 'timeline_entries', 'shortlist_items', 'follows',
    'subscription_settings', 'owner_posts', 'post_comments', 'saved_posts', 'reports',
    'autoflex_user_backups'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end
$$;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.owner_posts, public.post_comments to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy "Profiles are private to their owner" on public.profiles
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Garage vehicles are private to their owner" on public.garage_vehicles
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Timeline entries are private to their owner" on public.timeline_entries
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Shortlist items are private to their owner" on public.shortlist_items
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Follows are private to their owner" on public.follows
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Subscription settings are private to their owner" on public.subscription_settings
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Saved posts are private to their owner" on public.saved_posts
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Reports are private to their reporter" on public.reports
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Recovery backups are private to their owner" on public.autoflex_user_backups
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Owner posts are readable by everyone" on public.owner_posts
for select to anon, authenticated using (true);
create policy "Signed-in users create their own posts" on public.owner_posts
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Authors update their own posts" on public.owner_posts
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Authors delete their own posts" on public.owner_posts
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Comments are readable by everyone" on public.post_comments
for select to anon, authenticated using (true);
create policy "Signed-in users create their own comments" on public.post_comments
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Comment authors update their own comments" on public.post_comments
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Comment authors delete their own comments" on public.post_comments
for delete to authenticated using ((select auth.uid()) = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'garage_vehicles', 'timeline_entries', 'shortlist_items', 'follows',
    'subscription_settings', 'owner_posts', 'post_comments', 'reports', 'autoflex_user_backups'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_autoflex_updated_at()',
      table_name,
      table_name
    );
  end loop;
end
$$;
