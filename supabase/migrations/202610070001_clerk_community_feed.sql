-- Isolated community feed. Apply only after a production backup and Clerk provider setup.
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_subject text not null default (auth.jwt() ->> 'sub')
    check (author_subject ~ '^user_[A-Za-z0-9_-]+$'),
  title text not null check (char_length(trim(title)) between 1 and 160),
  author text not null check (char_length(trim(author)) between 1 and 80),
  brand text not null check (char_length(trim(brand)) between 1 and 80),
  model text not null check (char_length(model) <= 80),
  variant text not null check (char_length(variant) <= 80),
  city text not null check (char_length(city) <= 80),
  "odometerKm" integer not null check ("odometerKm" between 0 and 3000000),
  label text not null check (label in ('Review', 'Known issue', 'Fix', 'Cost note', 'Travelogue', 'Owner note')),
  topic text not null check (char_length(topic) <= 80),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  "createdAt" timestamptz not null default now(),
  status text not null default 'published' check (status in ('published', 'hidden'))
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_subject text not null default (auth.jwt() ->> 'sub')
    check (author_subject ~ '^user_[A-Za-z0-9_-]+$'),
  author text not null check (char_length(trim(author)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index community_posts_published_at on public.community_posts ("createdAt" desc) where status = 'published';
create index community_comments_post_at on public.community_comments (post_id, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
revoke all on public.community_posts, public.community_comments from public, anon, authenticated;
grant insert on public.community_posts, public.community_comments to authenticated;
grant select (id, title, author, brand, model, variant, city, "odometerKm", label, topic, body, "createdAt", status)
  on public.community_posts to authenticated;
grant select (post_id, author, body, created_at) on public.community_comments to authenticated;

create policy community_posts_member_read on public.community_posts for select to authenticated
  using (status = 'published'
    and (auth.jwt() ->> 'role') = 'authenticated'
    and (auth.jwt() ->> 'sub') ~ '^user_[A-Za-z0-9_-]+$');
create policy community_posts_clerk_insert on public.community_posts for insert to authenticated
  with check (author_subject = (auth.jwt() ->> 'sub')
    and (auth.jwt() ->> 'role') = 'authenticated'
    and (auth.jwt() ->> 'sub') ~ '^user_[A-Za-z0-9_-]+$'
    and status = 'published');
create policy community_comments_member_read on public.community_comments for select to authenticated
  using ((auth.jwt() ->> 'role') = 'authenticated'
    and (auth.jwt() ->> 'sub') ~ '^user_[A-Za-z0-9_-]+$'
    and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'));
create policy community_comments_clerk_insert on public.community_comments for insert to authenticated
  with check (author_subject = (auth.jwt() ->> 'sub')
    and (auth.jwt() ->> 'role') = 'authenticated'
    and (auth.jwt() ->> 'sub') ~ '^user_[A-Za-z0-9_-]+$'
    and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'));
