# TELECTRO Membership

Responsive Telectro membership website with Supabase-backed account authentication, private membership applications, admin status review, and server-side email notifications.

## Included membership flow

- Account signup/login and email confirmation through Supabase Auth
- Member application with contact and delivery details
- Private member view protected by PostgreSQL row-level security
- Admin-only application review and status updates
- Server-side new-application email notification through Resend
- Responsive premium dark UI with reduced-motion support

The listed offer is ₦75,000 for a five-month membership, with one mobile phone and three power banks stated as benefits. Confirm final eligibility, terms, availability, delivery coverage, refunds, and consumer disclosures before accepting applications or payment.

## Configure backend services

The code is integration-ready, but it will not authenticate or persist records until the project owner completes these setup steps:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Copy the project URL and public anon key into `supabase-config.js`. The anon key is intended for browser use; **never** place a service-role key or email-provider secret in this file.
3. In Supabase Auth, configure the site URL and allowed redirect URLs for the deployed domain, enable email confirmation, and configure production SMTP.
4. Deploy `supabase/functions/application-notification` and set its server-side secrets:

   ```sh
   supabase secrets set ADMIN_EMAIL=admin@example.com
   supabase secrets set EMAIL_FROM="Telectro <notifications@your-verified-domain.com>"
   supabase secrets set RESEND_API_KEY=re_...
   ```

   Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Do not copy the service-role key into the browser.
5. Verify the sender domain with Resend. Test signup verification email and the notification email before launching.
6. Create the first admin by registering its account, then run the commented role-promotion SQL at the bottom of `supabase/schema.sql` with the actual admin email. Keep admin access limited to trusted staff.
7. Deploy the static website (for example, on Vercel or GitHub Pages) and set the matching Supabase Auth redirect URL.

## Payment and withdrawals

This application does **not** collect payments or move money. An admin can mark payment as confirmed only after independently checking the official payment records. No withdrawal feature is included because withdrawals are not part of the membership offer described for this site. To add real payment processing later, integrate a regulated payment provider on the server side and verify signed provider webhooks; never trust a browser-side “paid” button or accept bank PINs/OTPs.

## Local preview

Serve the repository root with any static web server, for example:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`. Configure the Supabase project first to exercise authentication and application submission.

## Data and security notes

- Application addresses and contact details are personal data. Publish an appropriate privacy notice, retention period, and support contact before collecting them.
- RLS policies restrict member access to their own application. Admin role assignment is a trusted, manual database operation.
- Admin email notifications include application contact and delivery information. Protect the admin mailbox and restrict who can access it.
- Review `supabase/schema.sql` and test RLS with separate member and admin accounts before production.
