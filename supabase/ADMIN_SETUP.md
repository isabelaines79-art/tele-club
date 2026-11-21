## One-time admin setup

After deploying `admin-setup`, configure a strong server-only secret:

```sh
supabase secrets set ADMIN_SETUP_SECRET="<strong-random-value>"
supabase functions deploy admin-setup --no-verify-jwt
```

The hidden 10-tap administrator entry asks for:

- `don240364@gmail.com`
- A password of at least 8 characters
- The one-time setup secret

The function validates the secret server-side, creates or finds the account, confirms it, and promotes its `profiles.role` to `admin`. Public member signup remains unchanged.

After the account is promoted:

```sh
supabase secrets unset ADMIN_SETUP_SECRET
```

The setup function should then be disabled or removed so setup cannot be repeated.
