-- City pages need "how active is this city" numbers: post count, distinct
-- authors, top brands, hot topics. Today the client derives them from the
-- bounded page of posts it happens to hold and publishes the result into
-- `city_circles`, so the numbers are a sample, not a count, and they drift
-- further from the truth as the feed grows.
--
-- Computing them correctly means a GROUP BY over the whole of `owner_posts`.
-- That is O(table) and cannot run per page view, but the answer only has to be
-- minutes-accurate: nobody makes a decision on whether Pune has 1,240 or 1,251
-- posts. That is exactly the shape a materialised view fits.
--
-- Source is `owner_posts` ONLY, which is anon-readable. No RLS-protected table
-- feeds this view, so publishing aggregates of it leaks nothing. Garage counts
-- are deliberately excluded: `garage_vehicles` is owner-private.

create schema if not exists analytics;

comment on schema analytics is
  'Derived aggregates. NOT exposed through PostgREST; reach it through a security_invoker view in public.';

create materialized view if not exists analytics.city_feed_stats as
with normalised as (
  select
    trim(p.city) as city,
    regexp_replace(
      regexp_replace(lower(trim(p.city)), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ) as city_slug,
    trim(p.brand) as brand,
    trim(p.label) as label,
    p.user_id,
    p.helpful,
    p.fixes_confirmed,
    p.created_at
  from public.owner_posts p
  where trim(p.city) <> ''
),
brand_rank as (
  select
    city_slug,
    brand,
    row_number() over (partition by city_slug order by count(*) desc, brand) as position
  from normalised
  where brand <> ''
  group by city_slug, brand
),
topic_rank as (
  select
    city_slug,
    label,
    row_number() over (partition by city_slug order by count(*) desc, label) as position
  from normalised
  where label <> ''
  group by city_slug, label
)
select
  n.city_slug,
  min(n.city) as city,
  count(*)::int as post_count,
  count(distinct n.user_id)::int as author_count,
  coalesce(sum(n.helpful), 0)::int as helpful_total,
  coalesce(sum(n.fixes_confirmed), 0)::int as fixes_total,
  count(*) filter (where n.created_at > now() - interval '30 days')::int as posts_last_30d,
  max(n.created_at) as last_post_at,
  coalesce(
    (select array_agg(b.brand order by b.position)
       from brand_rank b where b.city_slug = n.city_slug and b.position <= 5),
    '{}'::text[]
  ) as top_brands,
  coalesce(
    (select array_agg(t.label order by t.position)
       from topic_rank t where t.city_slug = n.city_slug and t.position <= 3),
    '{}'::text[]
  ) as hot_topics,
  now() as computed_at
from normalised n
group by n.city_slug;

-- REFRESH ... CONCURRENTLY requires a unique index and is what keeps readers
-- unblocked during a refresh. Without it every refresh takes an ACCESS
-- EXCLUSIVE lock and city pages stall.
--
-- These two indexes are built without CONCURRENTLY on purpose: CONCURRENTLY is
-- not permitted on a materialized view, and the view is empty and unreferenced
-- at this point in the migration, so the lock is instantaneous and blocks
-- nothing.
create unique index if not exists city_feed_stats_city_slug_idx
  on analytics.city_feed_stats (city_slug);

create index if not exists city_feed_stats_post_count_idx
  on analytics.city_feed_stats (post_count desc, city_slug);

-- Read path. The materialised view stays out of the PostgREST-exposed schema so
-- it cannot be reached directly; `public.city_feed_stats` is a plain
-- security_invoker view, so the caller's own privileges apply.
create or replace view public.city_feed_stats
with (security_invoker = true) as
select
  city_slug,
  city,
  post_count,
  author_count,
  helpful_total,
  fixes_total,
  posts_last_30d,
  last_post_at,
  top_brands,
  hot_topics,
  computed_at
from analytics.city_feed_stats;

comment on view public.city_feed_stats is
  'Per-city feed aggregates, refreshed on a schedule. Derived solely from the anon-readable owner_posts table; may be up to ~15 minutes stale.';

grant usage on schema analytics to anon, authenticated;
grant select on analytics.city_feed_stats to anon, authenticated;
grant select on public.city_feed_stats to anon, authenticated;

-- Refresh entry point. SECURITY DEFINER because refreshing needs ownership of
-- the view, and locked to service_role so it can only be driven by the
-- scheduled job, never by a browser. pg_cron is not installed on this project,
-- so the schedule lives outside the database (Edge Function / CI cron) and
-- calls POST /rest/v1/rpc/refresh_city_feed_stats with the service role key.
create or replace function public.refresh_city_feed_stats()
returns timestamptz
language plpgsql
security definer
set search_path = analytics, public, pg_temp
as $$
begin
  begin
    refresh materialized view concurrently analytics.city_feed_stats;
  exception
    when object_not_in_prerequisite_state then
      -- Only reachable if the view has never been populated.
      refresh materialized view analytics.city_feed_stats;
  end;
  return now();
end;
$$;

revoke all on function public.refresh_city_feed_stats() from public;
revoke all on function public.refresh_city_feed_stats() from anon;
revoke all on function public.refresh_city_feed_stats() from authenticated;
grant execute on function public.refresh_city_feed_stats() to service_role;
