-- Structured owner-review prompts. Existing notes remain valid and default to no structured answer.
alter table public.community_posts
  add column review_pros text not null default '',
  add column review_cons text not null default '',
  add column review_verdict text not null default '',
  add constraint community_posts_review_pros_length check (char_length(review_pros) <= 2000),
  add constraint community_posts_review_cons_length check (char_length(review_cons) <= 2000),
  add constraint community_posts_review_verdict_value check (review_verdict in ('', 'buy-again', 'unsure', 'not-again')),
  add constraint community_posts_review_fields_complete check (
    (review_pros = '' and review_cons = '' and review_verdict = '')
    or (label = 'Review' and char_length(trim(review_pros)) > 0
      and char_length(trim(review_cons)) > 0 and review_verdict <> '')
  );

grant select (review_pros, review_cons, review_verdict) on public.community_posts to authenticated;
grant insert (review_pros, review_cons, review_verdict) on public.community_posts to authenticated;
grant update (review_pros, review_cons, review_verdict) on public.community_posts to authenticated;
