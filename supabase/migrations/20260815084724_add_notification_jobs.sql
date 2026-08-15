-- Reconstructed from the live schema for repo fidelity. Already applied as 20260815084724_add_notification_jobs.

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('Digest', 'Model alert', 'Topic alert', 'City alert', 'Reminder', 'Moderation')),
  channel text not null default 'Email digest'
    check (channel in ('Email digest', 'Browser alert', 'In-app')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  scheduled_for timestamptz not null default now(),
  status text not null default 'Queued'
    check (status in ('Queued', 'Sent', 'Failed', 'Cancelled', 'Skipped')),
  delivered_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text not null default '' check (char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

comment on table public.notification_jobs is
  'Queued notification work backing subscription_settings digests, follow alerts, and garage reminders.';

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('Email digest', 'Browser alert', 'In-app')),
  status text not null default 'Sent' check (status in ('Sent', 'Failed', 'Opened', 'Dismissed')),
  detail text not null default '' check (char_length(detail) <= 2000),
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, user_id) references public.notification_jobs (id, user_id) on delete cascade
);

comment on table public.notification_deliveries is
  'One delivery attempt or outcome for a notification job, kept for digest history and open tracking.';

create index notification_jobs_user_status_idx on public.notification_jobs (user_id, status, kind);
create index notification_jobs_user_scheduled_idx on public.notification_jobs (user_id, scheduled_for desc);
create index notification_jobs_status_scheduled_idx on public.notification_jobs (status, scheduled_for);
create index notification_deliveries_user_id_idx on public.notification_deliveries (user_id, delivered_at desc);
create index notification_deliveries_job_id_idx on public.notification_deliveries (job_id, delivered_at desc);

alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.notification_jobs, public.notification_deliveries from anon, authenticated;
grant select, insert, update, delete on public.notification_jobs, public.notification_deliveries to authenticated;

create policy "Notification jobs are private to their owner" on public.notification_jobs
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Notification deliveries are private to their owner" on public.notification_deliveries
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger set_notification_jobs_updated_at before update on public.notification_jobs
for each row execute function public.set_autoflex_updated_at();

create trigger set_notification_deliveries_updated_at before update on public.notification_deliveries
for each row execute function public.set_autoflex_updated_at();
