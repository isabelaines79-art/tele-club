# Paystack setup and verification

Membership checkout uses Paystack's hosted checkout. The browser does not need a Paystack public key: the `paystack-initialize` Edge Function creates the transaction with the secret key and returns Paystack's hosted authorization URL. Do not put the Paystack secret key in site JavaScript or commit it to Git.

## Deploy

1. Run `supabase/paystack-payments-migration.sql` in the Supabase SQL editor after `supabase/schema.sql`.
2. Set the server-only secret and deploy the functions:

   ```sh
   supabase secrets set PAYSTACK_SECRET_KEY=sk_test_or_live_secret
   supabase functions deploy paystack-initialize
   supabase functions deploy paystack-verify
   supabase functions deploy paystack-webhook
   ```

3. In Paystack Dashboard → Settings → API Keys & Webhooks, add this webhook URL:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook`
4. In Supabase Auth, ensure the deployed site URL and `/payment.html` are allowed redirect URLs. Test with Paystack test keys and a test payment before enabling live keys.

The webhook validates Paystack's HMAC-SHA512 signature and independently verifies the transaction with Paystack's API. The authenticated return-verification function performs the same API verification for a faster dashboard update. Both paths check the exact ₦75,000 amount, NGN currency, and locally initialized reference before atomically setting `payment_transactions.status = 'paid'` and `applications.payment_status = 'confirmed'`. Replayed events are safe. The migration prevents normal authenticated/admin browser updates from manually changing payment status.

Paystack public keys are not used in this hosted-checkout implementation. Never substitute a secret key into browser configuration.
