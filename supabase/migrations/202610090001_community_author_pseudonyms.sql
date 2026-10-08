-- Apply after 202610080001_community_feed_hardening.sql.
-- Public-facing names are stable, opaque labels derived from the authenticated Clerk subject.
create function public.community_author_pseudonym() returns text
  language sql stable set search_path = ''
as $$
  select case
    when (select auth.jwt() ->> 'sub') ~ '^user_[A-Za-z0-9_-]+$'
    then 'Member-' || pg_catalog.substr(
      pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to((select auth.jwt() ->> 'sub'), 'UTF8')),
        'hex'
      ),
      1,
      20
    )
  end;
$$;

revoke all on function public.community_author_pseudonym() from public, anon, authenticated;
grant execute on function public.community_author_pseudonym() to authenticated;

alter table public.community_posts
  alter column author set default public.community_author_pseudonym();
alter table public.community_comments
  alter column author set default public.community_author_pseudonym();

-- Replace previously client-selected display names while retaining the Clerk subject privately.
update public.community_posts
set author = 'Member-' || pg_catalog.substr(
  pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(author_subject, 'UTF8')), 'hex'), 1, 20
);
update public.community_comments
set author = 'Member-' || pg_catalog.substr(
  pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(author_subject, 'UTF8')), 'hex'), 1, 20
);

-- The database default supplies author; clients may no longer choose it on insert.
revoke insert (author) on public.community_posts, public.community_comments from authenticated;
