# Varelys Supabase Setup

1. Create the new Supabase project.
2. Copy `.env.example` to `.env` or `.dev.vars` and fill:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DATABASE_URL`
   - `SITE_HOST=inchouf.com`
3. Run the schema migrations:

```sh
npm run db:migrate
```

4. Set the owner password in your shell, then run the Varelys setup:

```sh
export VARELYS_ADMIN_PASSWORD='REPLACE_WITH_THE_PASSWORD_YOU_PROVIDED'
npm run varelys:setup
```

This creates or updates the Supabase Auth user for `varelysperfumes@gmail.com`,
creates the `varelysperfumes` tenant, inserts the owner app profile, sets cash on
delivery as the only payment method, creates a Lebanon delivery zone, and seeds
starter products whose images are read from the `products.image` database field.

If you prefer the Supabase SQL editor, run `supabase/varelys_seed.sql` after
migrations and replace `__SUPABASE_AUTH_USER_ID__` with the Auth user id for
`varelysperfumes@gmail.com`.
