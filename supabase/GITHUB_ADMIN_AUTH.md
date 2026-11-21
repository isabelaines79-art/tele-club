## GitHub sign-in for administrators

The hidden 10-tap entry opens `admin-github-login.html`. Configure GitHub OAuth before using it:

1. In Supabase, enable **GitHub** under **Authentication → Sign In / Providers** and enter the OAuth App Client ID and Client Secret.
2. In GitHub, create an OAuth App. Set its **Authorization callback URL** to:
   `https://ooiawhnemxazflyjqcst.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → URL Configuration**, add your deployed site URL and the exact callback page URL `https://YOUR-DOMAIN/admin-github-login.html` to the allowed redirect URLs. For local preview, add `http://localhost:4173/admin-github-login.html`.
4. Sign in once with the intended GitHub account, then assign `role = 'admin'` to that account's profile using a trusted database operation. GitHub OAuth may not expose the email address, so identify the new Auth user by its GitHub provider identity/user ID rather than relying on email alone.
5. Test using the intended admin GitHub account and a separate non-admin account. The non-admin must be denied and signed out.

GitHub authentication proves identity; it does not grant administrator privileges. The dashboard and database row-level security continue to require `profiles.role = 'admin'`. Member signup remains on its separate public email/password flow. Keep the GitHub OAuth Client Secret only in Supabase provider settings, never in the browser or repository.
