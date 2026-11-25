-- Referral credits: a fixed, transparent ₦10,000 reward only after the invitee is
-- both approved and their payment is independently confirmed by an administrator.
-- Run after supabase/schema.sql and supabase/member-payouts-migration.sql.
-- This migration does not implement a prize wheel, lottery, or vehicle prize.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles
SET referral_code = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))
WHERE referral_code IS NULL OR btrim(referral_code) = '';

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET DEFAULT upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code);

CREATE TABLE IF NOT EXISTS public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_amount numeric(12,2) NOT NULL DEFAULT 10000 CHECK (reward_amount = 10000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','earned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  earned_at timestamptz,
  CHECK (referrer_id <> referred_user_id)
);

ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read own referral credits" ON public.referral_credits;
CREATE POLICY "Members read own referral credits"
  ON public.referral_credits FOR SELECT TO authenticated
  USING (referrer_id = (SELECT auth.uid()));
REVOKE ALL ON public.referral_credits FROM anon, public;
GRANT SELECT ON public.referral_credits TO authenticated;

-- Keep the existing profile creation behavior and add referral attribution from
-- signup metadata. Referral codes are identifiers, never proof of payment.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referrer uuid;
BEGIN
  SELECT p.id INTO v_referrer
  FROM public.profiles AS p
  WHERE p.referral_code = upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')))
    AND p.id <> new.id
  LIMIT 1;

  INSERT INTO public.profiles (id, full_name, referred_by)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_referrer
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_referrer IS NOT NULL THEN
    INSERT INTO public.referral_credits (referrer_id, referred_user_id)
    VALUES (v_referrer, new.id)
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

-- A referral becomes earned only when the admin has both approved the application
-- and confirmed payment. The unique referred_user_id constraint prevents duplicates.
CREATE OR REPLACE FUNCTION public.earn_verified_referral_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.application_status = 'approved' AND NEW.payment_status = 'confirmed' THEN
    UPDATE public.referral_credits
    SET status = 'earned', earned_at = coalesce(earned_at, now())
    WHERE referred_user_id = NEW.user_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_earn_referral_credit ON public.applications;
CREATE TRIGGER applications_earn_referral_credit
AFTER INSERT OR UPDATE OF application_status, payment_status ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.earn_verified_referral_credit();

-- Backfill any referred members who already meet the verification requirement.
UPDATE public.referral_credits AS r
SET status = 'earned', earned_at = coalesce(r.earned_at, now())
FROM public.applications AS a
WHERE a.user_id = r.referred_user_id
  AND a.application_status = 'approved'
  AND a.payment_status = 'confirmed'
  AND r.status = 'pending';
