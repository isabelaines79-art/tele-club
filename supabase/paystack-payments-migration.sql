-- Paystack-backed membership payment records. Run after schema.sql.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  paystack_reference text not null unique,
  amount_kobo integer not null check (amount_kobo = 7500000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  authorization_url text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payment_transactions_application_owner unique (application_id, paystack_reference)
);

alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from anon, public;
grant select on public.payment_transactions to authenticated;
drop policy if exists "Members read own payment transactions" on public.payment_transactions;
create policy "Members read own payment transactions" on public.payment_transactions
  for select to authenticated using (user_id = (select auth.uid()) or public.is_telectro_admin());

-- Only verified Paystack server callbacks may change the payment status. This prevents
-- the existing admin application editor from manually marking a payment as confirmed.
create or replace function public.prevent_unverified_payment_status_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.payment_status is distinct from old.payment_status
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Payment status can only be changed by verified payment processing';
  end if;
  return new;
end;
$$;
drop trigger if exists applications_verified_payment_status on public.applications;
create trigger applications_verified_payment_status
before update of payment_status on public.applications
for each row execute function public.prevent_unverified_payment_status_change();

-- Called only by the Edge Functions after checking Paystack's signature/API response.
-- Payment row and application status transition are atomic and idempotent.
create or replace function public.confirm_paystack_payment(p_reference text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.payment_transactions%rowtype;
begin
  select * into v_payment from public.payment_transactions
    where paystack_reference = p_reference for update;
  if not found then raise exception 'Unknown payment reference'; end if;
  if v_payment.amount_kobo <> 7500000 or v_payment.currency <> 'NGN' then
    raise exception 'Payment amount or currency mismatch';
  end if;
  if v_payment.status = 'paid' then return true; end if;
  update public.payment_transactions set status = 'paid', paid_at = now()
    where id = v_payment.id;
  update public.applications set payment_status = 'confirmed', updated_at = now()
    where id = v_payment.application_id and user_id = v_payment.user_id;
  if not found then raise exception 'Payment application was not found'; end if;
  return true;
end;
$$;
revoke all on function public.confirm_paystack_payment(text) from public, anon, authenticated;
grant execute on function public.confirm_paystack_payment(text) to service_role;
