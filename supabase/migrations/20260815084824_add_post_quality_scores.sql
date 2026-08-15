-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084824_add_post_quality_scores.

alter table public.owner_posts add column quality_score integer not null default 0;
alter table public.owner_posts add column quality_grade text not null default 'Needs context';
alter table public.owner_posts add column ranking_score numeric(10, 4) not null default 0;
alter table public.owner_posts add column last_ranked_at timestamptz;

create table public.post_quality_scores (
  post_id text primary key references public.owner_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  max_score integer not null default 0 check (max_score >= 0),
  grade text not null default 'Needs context'
    check (grade in ('Needs context', 'Useful draft', 'Garage-grade')),
  components jsonb not null default '{}'::jsonb check (jsonb_typeof(components) = 'object'),
  strengths text[] not null default '{}',
  missing_prompts text[] not null default '{}',
  ranking_score numeric(10, 4) not null default 0,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.post_quality_scores is
  'Hosted moderation and ranking signal per post; mirrors the local assessPostQuality() PostQualityReport.';

create index owner_posts_quality_score_idx on public.owner_posts (quality_score desc, created_at desc);
create index owner_posts_ranking_score_idx on public.owner_posts (ranking_score desc, created_at desc);
create index post_quality_scores_user_id_idx on public.post_quality_scores (user_id, computed_at desc);
create index post_quality_scores_grade_idx on public.post_quality_scores (grade, score desc);
create index post_quality_scores_ranking_idx on public.post_quality_scores (ranking_score desc, computed_at desc);

alter table public.post_quality_scores enable row level security;

revoke all on public.post_quality_scores from anon, authenticated;
grant select on public.post_quality_scores to anon;
grant select, insert, update, delete on public.post_quality_scores to authenticated;

create policy "Post quality scores are readable by everyone" on public.post_quality_scores
for select to anon, authenticated using (true);
create policy "Authors create quality scores for their own posts" on public.post_quality_scores
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Authors update quality scores for their own posts" on public.post_quality_scores
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Authors delete quality scores for their own posts" on public.post_quality_scores
for delete to authenticated using ((select auth.uid()) = user_id);

create trigger set_post_quality_scores_updated_at before update on public.post_quality_scores
for each row execute function public.set_autoflex_updated_at();
