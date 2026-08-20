-- The feed used to load every row of post_comments purely to render a count.
-- Denormalising the count onto owner_posts lets the feed page fetch counts
-- inline and load comment bodies only when a post is opened.
alter table public.owner_posts
  add column if not exists comment_count integer not null default 0;

create or replace function public.sync_owner_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.owner_posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.owner_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  elsif (tg_op = 'UPDATE' and new.post_id is distinct from old.post_id) then
    update public.owner_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    update public.owner_posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists post_comments_count_trigger on public.post_comments;
create trigger post_comments_count_trigger
  after insert or delete or update of post_id on public.post_comments
  for each row execute function public.sync_owner_post_comment_count();

update public.owner_posts p
  set comment_count = coalesce(c.total, 0)
  from (select post_id, count(*)::int as total from public.post_comments group by post_id) c
  where c.post_id = p.id;

-- Keyset pagination reads (ordering column, primary key) as a pair, so the
-- index has to carry both to avoid a sort. Verified with EXPLAIN: Index Only
-- Scan, Heap Fetches 0.
create index if not exists owner_posts_created_at_id_idx
  on public.owner_posts (created_at desc, id desc);

create index if not exists owner_posts_ranking_score_id_idx
  on public.owner_posts (ranking_score desc, id desc);

comment on column public.owner_posts.comment_count is 'Denormalised count maintained by post_comments_count_trigger; lets the feed avoid reading comment bodies.';
