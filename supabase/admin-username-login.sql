-- Private username lookup for authorized Telectro admin accounts.
-- Run this migration in the Supabase SQL editor before deploying admin-login.
create table if not exists public.admin_usernames (
  username text primary key check (username ~ '^[a-z0-9._-]{3,32}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_usernames enable row level security;
revoke all on public.admin_usernames from public, anon, authenticated;
grant select on public.admin_usernames to service_role;

-- Basic per-username lockout for repeated failed admin sign-in attempts.
create table if not exists public.admin_login_attempts (
  username text primary key,
  failure_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.admin_login_attempts to service_role;

create or replace function public.admin_login_is_locked(p_username text)
returns boolean language sql security definer set search_path = '' as $$
  select coalesce((select a.locked_until > now() from public.admin_login_attempts a where a.username = lower(trim(p_username))), false);
$$;
create or replace function public.admin_login_failure(p_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare current_count integer;
begin
  insert into public.admin_login_attempts(username, failure_count, locked_until, updated_at)
  values (lower(trim(p_username)), 1, null, now())
  on conflict (username) do update set
    failure_count = case when public.admin_login_attempts.locked_until > now() then public.admin_login_attempts.failure_count else public.admin_login_attempts.failure_count + 1 end,
    locked_until = case when public.admin_login_attempts.locked_until > now() then public.admin_login_attempts.locked_until
      when public.admin_login_attempts.failure_count + 1 >= 5 then now() + interval '15 minutes' else null end,
    updated_at = now();
end;
$$;
create or replace function public.admin_login_success(p_username text)
returns void language sql security definer set search_path = '' as $$
  delete from public.admin_login_attempts where username = lower(trim(p_username));
$$;
revoke all on function public.admin_login_is_locked(text) from public, anon, authenticated;
revoke all on function public.admin_login_failure(text) from public, anon, authenticated;
revoke all on function public.admin_login_success(text) from public, anon, authenticated;
grant execute on function public.admin_login_is_locked(text) to service_role;
grant execute on function public.admin_login_failure(text) to service_role;
grant execute on function public.admin_login_success(text) to service_role;

-- After you have an existing admin Auth account, register its chosen username.
-- Replace both values, then run this once:
-- insert into public.admin_usernames (username, user_id)
-- select lower('YOUR_ADMIN_USERNAME'), id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict (username) do update set user_id = excluded.user_id;
