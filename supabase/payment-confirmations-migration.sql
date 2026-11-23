-- Records a member's voluntary confirmation that they sent membership payment.
-- The admin still makes the independent payment_status decision in applications.
create table if not exists public.payment_confirmations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  confirmed_at timestamptz,
  admin_note text not null default '' check (char_length(admin_note) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.payment_confirmations enable row level security;

create or replace function public.set_payment_confirmation_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists payment_confirmations_updated_at on public.payment_confirmations;
create trigger payment_confirmations_updated_at before update on public.payment_confirmations
for each row execute procedure public.set_payment_confirmation_updated_at();

drop policy if exists "Members manage own payment confirmation" on public.payment_confirmations;
drop policy if exists "Members insert own payment confirmation" on public.payment_confirmations;
drop policy if exists "Members read own payment confirmation" on public.payment_confirmations;
create policy "Members insert own payment confirmation" on public.payment_confirmations
for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');
create policy "Members read own payment confirmation" on public.payment_confirmations
for select to authenticated
using (user_id = (select auth.uid()) or public.is_telectro_admin());

drop policy if exists "Admins manage payment confirmations" on public.payment_confirmations;
create policy "Admins manage payment confirmations" on public.payment_confirmations
for all to authenticated
using (public.is_telectro_admin())
with check (public.is_telectro_admin());
