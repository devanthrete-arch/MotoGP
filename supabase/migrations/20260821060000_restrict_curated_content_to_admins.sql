-- S-2: city_circles.slug and model_playbooks.id are global names. Any signed-in
-- account could claim one and, as its curator, hold it permanently — so a script
-- could take every major city and lock legitimate curation out for good.
-- Curated content is now admin-only. Reads stay public.

create table if not exists public.app_admins (
  user_id uuid primary key,
  note text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.app_admins is 'Accounts allowed to curate shared content (city circles, model playbooks). Managed out-of-band via service_role; not readable or writable through the API.';

alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

drop policy if exists "Signed-in users create city circles" on public.city_circles;
drop policy if exists "Curators update their city circles" on public.city_circles;
drop policy if exists "Curators delete their city circles" on public.city_circles;
create policy "Admins create city circles" on public.city_circles for insert to authenticated with check (public.is_app_admin());
create policy "Admins update city circles" on public.city_circles for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "Admins delete city circles" on public.city_circles for delete to authenticated using (public.is_app_admin());

drop policy if exists "Signed-in users create model playbooks" on public.model_playbooks;
drop policy if exists "Curators update their model playbooks" on public.model_playbooks;
drop policy if exists "Curators delete their model playbooks" on public.model_playbooks;
create policy "Admins create model playbooks" on public.model_playbooks for insert to authenticated with check (public.is_app_admin());
create policy "Admins update model playbooks" on public.model_playbooks for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "Admins delete model playbooks" on public.model_playbooks for delete to authenticated using (public.is_app_admin());
