-- Run this schema in the Supabase SQL editor for your project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  application_status text not null default 'pending' check (application_status in ('pending','approved','rejected')),
  payment_status text not null default 'pending' check (payment_status in ('pending','confirmed','rejected')),
  delivery_status text not null default 'not_started' check (delivery_status in ('not_started','preparing','dispatched','delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists applications_updated_at on public.applications;
create trigger applications_updated_at before update on public.applications
for each row execute procedure public.set_updated_at();

create or replace function public.is_telectro_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;
revoke all on function public.is_telectro_admin() from public;
grant execute on function public.is_telectro_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.applications enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_telectro_admin());
drop policy if exists "Users update own name" on public.profiles;
create policy "Users update own name" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = 'member');

drop policy if exists "Members read own application" on public.applications;
create policy "Members read own application" on public.applications for select to authenticated using (user_id = (select auth.uid()) or public.is_telectro_admin());
drop policy if exists "Members submit own pending application" on public.applications;
create policy "Members submit own pending application" on public.applications for insert to authenticated with check (
  user_id = (select auth.uid()) and application_status = 'pending' and payment_status = 'pending' and delivery_status = 'not_started'
);
drop policy if exists "Admins update applications" on public.applications;
create policy "Admins update applications" on public.applications for update to authenticated using (public.is_telectro_admin()) with check (public.is_telectro_admin());

grant select, update on public.profiles to authenticated;
grant select, insert on public.applications to authenticated;
grant update on public.applications to authenticated;
-- RLS restricts application updates to admins. Promote a trusted account manually:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
