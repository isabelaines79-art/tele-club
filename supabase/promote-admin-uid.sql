-- Promote the authorized Supabase Auth user to administrator.
-- Run this once in the Supabase SQL editor for the project used by Telectro.
-- The user must already exist in auth.users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = '419f06f3-74b0-4837-baf2-e325956b1c7b'::uuid
  ) THEN
    RAISE EXCEPTION 'No Supabase Auth user exists with the requested UID';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  SELECT id, COALESCE(raw_user_meta_data ->> 'full_name', ''), 'admin'
  FROM auth.users
  WHERE id = '419f06f3-74b0-4837-baf2-e325956b1c7b'::uuid
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
END
$$;

-- Verify the promotion:
SELECT id, full_name, role
FROM public.profiles
WHERE id = '419f06f3-74b0-4837-baf2-e325956b1c7b'::uuid;
