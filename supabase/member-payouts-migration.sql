-- Add member payout details and admin-managed monthly payout history.
-- Run after supabase/schema.sql in the Supabase SQL editor.
create table if not exists public.member_payment_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_name text not null check (char_length(account_name) between 2 and 120),
  bank_name text not null check (char_length(bank_name) between 2 and 120),
  account_number text not null check (account_number ~ '^[0-9]{6,20}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payout_month date not null,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'planned' check (status in ('planned','paid','failed')),
  paid_at timestamptz,
  reference text not null default '' check (char_length(reference) <= 120),
  admin_note text not null default '' check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, payout_month)
);

create or replace function public.set_member_payout_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists member_payment_details_updated_at on public.member_payment_details;
create trigger member_payment_details_updated_at before update on public.member_payment_details
for each row execute procedure public.set_member_payout_updated_at();
drop trigger if exists member_payouts_updated_at on public.member_payouts;
create trigger member_payouts_updated_at before update on public.member_payouts
for each row execute procedure public.set_member_payout_updated_at();

alter table public.member_payment_details enable row level security;
alter table public.member_payouts enable row level security;

drop policy if exists "Members read own payout details" on public.member_payment_details;
create policy "Members read own payout details" on public.member_payment_details for select to authenticated
using (user_id = (select auth.uid()) or public.is_telectro_admin());
drop policy if exists "Members manage own payout details" on public.member_payment_details;
create policy "Members manage own payout details" on public.member_payment_details for insert to authenticated
with check (user_id = (select auth.uid()));
drop policy if exists "Members update own payout details" on public.member_payment_details;
create policy "Members update own payout details" on public.member_payment_details for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "Admins read member payout details" on public.member_payment_details;
create policy "Admins read member payout details" on public.member_payment_details for select to authenticated
using (public.is_telectro_admin());

drop policy if exists "Members read own payout history" on public.member_payouts;
create policy "Members read own payout history" on public.member_payouts for select to authenticated
using (user_id = (select auth.uid()) or public.is_telectro_admin());
drop policy if exists "Admins create payouts" on public.member_payouts;
create policy "Admins create payouts" on public.member_payouts for insert to authenticated
with check (public.is_telectro_admin());
drop policy if exists "Admins update payouts" on public.member_payouts;
create policy "Admins update payouts" on public.member_payouts for update to authenticated
using (public.is_telectro_admin()) with check (public.is_telectro_admin());
drop policy if exists "Admins delete payouts" on public.member_payouts;
create policy "Admins delete payouts" on public.member_payouts for delete to authenticated
using (public.is_telectro_admin());

grant select, insert, update on public.member_payment_details to authenticated;
grant select, insert, update, delete on public.member_payouts to authenticated;
