-- Membership approval and five monthly installment tracker.
-- Run in Supabase SQL Editor after schema.sql and member-payouts-migration.sql.
-- The published ₦75,000 / five-month offer is represented as five ₦15,000 installments.

create table if not exists public.membership_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_number smallint not null check (month_number between 1 and 5),
  due_month date not null,
  amount numeric(12,2) not null default 15000 check (amount > 0),
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, month_number)
);

create or replace function public.set_membership_month_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status = 'paid' and old.status <> 'paid' then
    new.paid_at = now();
  elsif new.status = 'unpaid' then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists membership_months_updated_at on public.membership_months;
create trigger membership_months_updated_at before update on public.membership_months
for each row execute procedure public.set_membership_month_updated_at();

alter table public.membership_months enable row level security;
drop policy if exists "Members read own membership months" on public.membership_months;
create policy "Members read own membership months" on public.membership_months for select to authenticated
using (user_id = (select auth.uid()) or public.is_telectro_admin());
drop policy if exists "Admins update membership months" on public.membership_months;
create policy "Admins update membership months" on public.membership_months for update to authenticated
using (public.is_telectro_admin()) with check (public.is_telectro_admin());
drop policy if exists "Admins read all membership months" on public.membership_months;
create policy "Admins read all membership months" on public.membership_months for select to authenticated
using (public.is_telectro_admin());
grant select, update on public.membership_months to authenticated;

create or replace function public.approve_membership_application(p_application_id uuid, p_start_date date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_telectro_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select a.user_id into target_user_id
  from public.applications a where a.id = p_application_id for update;
  if target_user_id is null then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;

  update public.applications set application_status = 'approved'
  where id = p_application_id;

  insert into public.membership_months (user_id, month_number, due_month, amount)
  select target_user_id, month_index,
         (date_trunc('month', p_start_date)::date + ((month_index - 1) || ' months')::interval)::date,
         15000
  from generate_series(1, 5) as month_index
  on conflict (user_id, month_number) do nothing;
end;
$$;
revoke all on function public.approve_membership_application(uuid, date) from public;
grant execute on function public.approve_membership_application(uuid, date) to authenticated;
