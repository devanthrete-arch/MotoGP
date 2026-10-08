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

create function public.set_community_author_pseudonym() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.author := public.community_author_pseudonym();
  return new;
end;
$$;
revoke all on function public.set_community_author_pseudonym() from public, anon, authenticated;

create trigger community_posts_set_author before insert on public.community_posts
  for each row execute function public.set_community_author_pseudonym();
create trigger community_comments_set_author before insert on public.community_comments
  for each row execute function public.set_community_author_pseudonym();

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

-- Keep the author column grant during rollout: older app versions still send it, but the trigger
-- replaces the submitted value before it can reach a row.
