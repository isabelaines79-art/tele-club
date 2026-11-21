## Google sign-in for administrators

The hidden 10-tap entry opens `admin-google-login.html`. Configure Google OAuth before using it:

1. In Supabase, enable the Google provider under **Authentication → Sign In / Providers** and add the OAuth client ID and client secret from Google Cloud.
2. In Google Cloud, configure the authorized redirect URI shown by Supabase for your project (the Supabase Auth callback URL).
3. Add both your deployed site URL and `http://localhost:4173/admin-google-login.html` (for local preview) to Supabase's allowed redirect URLs. Use the exact deployed callback page URL as appropriate for your host.
4. Ensure the Google identity uses the same verified email as the already-authorized admin profile. For the configured first admin, promote the account for `don240364@gmail.com` through the trusted server-side setup or database operation before sign-in.
5. Test with an authorized Google account and a separate non-admin account. The latter must be denied and signed out.

Google authentication proves identity, but it does not grant administrator privileges. The dashboard and database row-level security continue to require `profiles.role = 'admin'`. Public member signup stays on its existing email/password flow.
