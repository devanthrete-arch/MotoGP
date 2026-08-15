-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084807_add_feedback_entries.

create table public.feedback_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  loop_stage text not null default 'Real user'
    check (loop_stage in ('Product owner', 'Designer', 'Backend engineer', 'Frontend engineer', 'Tested / QA', 'Real user')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'New' check (status in ('New', 'Reviewing', 'Planned', 'Shipped')),
  surface text not null default '' check (char_length(surface) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.feedback_entries is
  'In-product feedback capture mirroring the local FeedbackNote shape (loopStage, message, status).';

create index feedback_entries_user_id_idx on public.feedback_entries (user_id, created_at desc);
create index feedback_entries_status_idx on public.feedback_entries (status, created_at desc);
create index feedback_entries_loop_stage_idx on public.feedback_entries (loop_stage, created_at desc);

alter table public.feedback_entries enable row level security;

revoke all on public.feedback_entries from anon, authenticated;
grant select, insert, update, delete on public.feedback_entries to authenticated;

create policy "Feedback entries are private to their author" on public.feedback_entries
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_feedback_entries_updated_at before update on public.feedback_entries
for each row execute function public.set_autoflex_updated_at();
