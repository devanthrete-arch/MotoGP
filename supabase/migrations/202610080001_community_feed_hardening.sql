-- Hardens the shared community feed. Apply after 202610070001_clerk_community_feed.sql.

-- Members supply content columns only. id, author_subject, "createdAt"/created_at and status always
-- come from column defaults, so a post can no longer be dated into the future to pin it.
revoke insert on public.community_posts, public.community_comments from authenticated;
grant insert (title, author, brand, model, variant, city, "odometerKm", label, topic, body)
  on public.community_posts to authenticated;
grant insert (post_id, author, body) on public.community_comments to authenticated;

-- Repair rows written while the open grant was in place: nothing stays dated into the future, and
-- padded values are trimmed. The original checks already bound the trimmed length, so after this
-- every row fits the raw-length limits below and a moderator can change its status.
update public.community_posts set "createdAt" = now() where "createdAt" > now();
update public.community_comments set created_at = now() where created_at > now();
update public.community_posts
  set title = trim(title), author = trim(author), brand = trim(brand), body = trim(body)
  where char_length(title) > 160 or char_length(author) > 80 or char_length(brand) > 80 or char_length(body) > 10000;
update public.community_comments
  set author = trim(author), body = trim(body)
  where char_length(author) > 80 or char_length(body) > 4000;

-- The original limits measured trim(value), so whitespace padding bypassed them.
alter table public.community_posts
  add constraint community_posts_title_raw_length check (char_length(title) <= 160),
  add constraint community_posts_author_raw_length check (char_length(author) <= 80),
  add constraint community_posts_brand_raw_length check (char_length(brand) <= 80),
  add constraint community_posts_body_raw_length check (char_length(body) <= 10000);
alter table public.community_comments
  add constraint community_comments_author_raw_length check (char_length(author) <= 80),
  add constraint community_comments_body_raw_length check (char_length(body) <= 4000);

-- Authors can correct or remove what they published. "createdAt", status and author_subject stay
-- out of the update grant. A hidden post can be neither edited back into view nor deleted by its
-- author, so the moderation record survives; the project owner removes hidden content on request.
grant update (title, brand, model, variant, city, "odometerKm", label, topic, body)
  on public.community_posts to authenticated;
grant delete on public.community_posts to authenticated;

create policy community_posts_owner_update on public.community_posts for update to authenticated
  using (author_subject = (auth.jwt() ->> 'sub')
    and (auth.jwt() ->> 'role') = 'authenticated'
    and status = 'published')
  with check (author_subject = (auth.jwt() ->> 'sub') and status = 'published');
create policy community_posts_owner_delete on public.community_posts for delete to authenticated
  using (author_subject = (auth.jwt() ->> 'sub')
    and (auth.jwt() ->> 'role') = 'authenticated'
    and status = 'published');

-- author_subject is not readable by members, so the app asks which published posts are the caller's.
create function public.my_community_post_ids() returns setof uuid
  language sql stable security definer set search_path = ''
as $$
  select p.id from public.community_posts p
  where p.author_subject = (select auth.jwt() ->> 'sub')
    and (select auth.jwt() ->> 'role') = 'authenticated'
    and p.status = 'published';
$$;

-- Reports reach the server. One open report per member per post; once it is resolved the member
-- can report the post again, since authors can edit what they published.
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_subject text not null default (auth.jwt() ->> 'sub')
    check (reporter_subject ~ '^user_[A-Za-z0-9_-]+$'),
  reason text not null check (char_length(reason) <= 2000 and char_length(trim(reason)) >= 1),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);
create unique index community_reports_one_open on public.community_reports (post_id, reporter_subject)
  where status = 'open';

-- Moderators are listed by Clerk subject. Rows are added by the project owner in the SQL editor;
-- no client role can read or change this table.
create table public.community_moderators (
  subject text primary key check (subject ~ '^user_[A-Za-z0-9_-]+$'),
  added_at timestamptz not null default now()
);

create index community_reports_open_at on public.community_reports (created_at) where status = 'open';

alter table public.community_reports enable row level security;
alter table public.community_moderators enable row level security;
revoke all on public.community_reports, public.community_moderators from public, anon, authenticated;
grant insert (post_id, reason) on public.community_reports to authenticated;

create policy community_reports_member_insert on public.community_reports for insert to authenticated
  with check (reporter_subject = (auth.jwt() ->> 'sub')
    and (auth.jwt() ->> 'role') = 'authenticated'
    and status = 'open'
    and exists (select 1 from public.community_posts p where p.id = post_id and p.status = 'published'));

create function public.is_community_moderator() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role') = 'authenticated', false)
    and exists (select 1 from public.community_moderators m where m.subject = (select auth.jwt() ->> 'sub'));
$$;

-- The queue is open reports, oldest first, so resolving the page in view always surfaces the next
-- ones. Pass false to read the 200 most recent reports of any status.
create function public.list_community_reports(only_open boolean default true)
  returns table (report_id uuid, reported_post_id uuid, post_title text, post_status text,
    report_reason text, report_status text, reported_at timestamptz)
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_community_moderator() then
    raise exception 'Moderator access is required' using errcode = '42501';
  end if;
  if coalesce(only_open, true) then
    return query
      select r.id, r.post_id, p.title, p.status, r.reason, r.status, r.created_at
      from public.community_reports r
      join public.community_posts p on p.id = r.post_id
      where r.status = 'open'
      order by r.created_at
      limit 200;
  else
    return query
      select r.id, r.post_id, p.title, p.status, r.reason, r.status, r.created_at
      from public.community_reports r
      join public.community_posts p on p.id = r.post_id
      order by r.created_at desc
      limit 200;
  end if;
end;
$$;

-- Hiding a post closes its open reports; restoring it leaves the report history alone.
create function public.moderate_community_post(target_post uuid, next_status text) returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_community_moderator() then
    raise exception 'Moderator access is required' using errcode = '42501';
  end if;
  if next_status is null or next_status not in ('published', 'hidden') then
    raise exception 'Status must be published or hidden' using errcode = '22023';
  end if;
  update public.community_posts set status = next_status where id = target_post;
  if not found then
    raise exception 'Post was not found' using errcode = 'P0002';
  end if;
  if next_status = 'hidden' then
    update public.community_reports set status = 'actioned' where post_id = target_post and status = 'open';
  end if;
end;
$$;

create function public.resolve_community_report(target_report uuid, next_status text) returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_community_moderator() then
    raise exception 'Moderator access is required' using errcode = '42501';
  end if;
  if next_status is null or next_status not in ('dismissed', 'actioned') then
    raise exception 'Status must be dismissed or actioned' using errcode = '22023';
  end if;
  update public.community_reports set status = next_status where id = target_report;
  if not found then
    raise exception 'Report was not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.my_community_post_ids(), public.is_community_moderator(),
  public.list_community_reports(boolean), public.moderate_community_post(uuid, text),
  public.resolve_community_report(uuid, text) from public, anon;
grant execute on function public.my_community_post_ids(), public.is_community_moderator(),
  public.list_community_reports(boolean), public.moderate_community_post(uuid, text),
  public.resolve_community_report(uuid, text) to authenticated;
