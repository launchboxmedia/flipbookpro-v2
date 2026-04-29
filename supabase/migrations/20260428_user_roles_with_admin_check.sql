-- Roles table for admin/moderator/etc. The admin page already queries this
-- table; previously missing, which caused all admin checks to silently fail.

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- SECURITY DEFINER function avoids RLS recursion when policies need to check
-- if the caller is an admin (a policy on user_roles can't safely query
-- user_roles directly).
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'
  );
$$;

revoke execute on function public.is_admin(uuid) from anon;
grant execute on function public.is_admin(uuid) to authenticated;

alter table public.user_roles enable row level security;

-- Users can read their own role rows (for UI badges, gating).
drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Admins can read every role row.
drop policy if exists "user_roles_admin_select" on public.user_roles;
create policy "user_roles_admin_select"
  on public.user_roles for select
  to authenticated
  using (public.is_admin((select auth.uid())));

-- Only admins can insert/update/delete role rows.
drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_admin_write"
  on public.user_roles for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));
