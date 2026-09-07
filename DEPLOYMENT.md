# Deployment

OrderPilot remains a Vinext application deployed as a Cloudflare Worker through the existing Sites project `appgprj_6a9c1233527481919635712e9d8b5aba`. Supabase supplies PostgreSQL and Auth. Cloudflare R2 remains the private `FILES` binding. There is no D1 binding or SQLite runtime dependency.

## Supabase setup

1. Create or select the Supabase project.
2. From Project Settings > API, copy the Project URL, publishable/anon key and server-only secret/service-role key.
3. From Connect, copy the PostgreSQL URI for local migrations. Use the transaction pooler URI on port 6543 when available.
4. Run `npm run db:migrate` with `SUPABASE_DATABASE_URL` set, or run the generated SQL files in order in the Supabase SQL Editor.
5. Confirm the migration created the RLS policies, integrity triggers and private RPC functions `op_query` and `op_batch`.

For existing production databases, apply `drizzle/0003_delivery_branding_settlements.sql` before using external-courier delivery, tenant logos or cash settlements. The migration is additive: it adds delivery method/provider columns, settlement tables, tenant indexes and RLS policies.

The service-role key is required only by the Worker server runtime and must never be placed in client-exposed Vite variables. The bootstrap endpoint creates the first Supabase Auth-backed `super_admin` profile once; remove `BOOTSTRAP_TOKEN` after provisioning.

## Cloudflare settings

Configure these Worker variables/secrets exactly:

- `SUPABASE_URL`: Supabase Project URL.
- `SUPABASE_ANON_KEY`: Supabase publishable/anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase secret/service-role key, stored as an encrypted secret.
- `SITE_HOST`: deployed Sites hostname, or the configured canonical application hostname.
- `BOOTSTRAP_TOKEN`: one-time random encrypted secret, removed after bootstrap.

Keep the existing R2 bucket binding `FILES` → `site-creator-r2`. The configuration must not include `d1` or `d1_databases`. `SUPABASE_DATABASE_URL` is for local/CI migration commands only and is not required in the Worker.

The exact temporary Worker hostname `pos-inchouf.hassanmezher084.workers.dev` is explicitly allowlisted for testing. Other workers.dev hostnames remain rejected. `SITE_HOST=inchouf.com` continues to govern the production custom-domain architecture.

Production custom domains currently expected by the application are `inchouf.com`, `app.inchouf.com`, `admin.inchouf.com` and wildcard tenant subdomains under `inchouf.com`.

### Cloudflare CI build commands

Set exactly these in the Cloudflare dashboard (Workers & Pages → Settings → Build):

| Setting        | Value                           |
| -------------- | ------------------------------- |
| Build command  | `npm run build`                 |
| Deploy command | `npx @vinext/cloudflare deploy` |

`wrangler.json` is committed to the repository root and must remain tracked. `@vinext/cloudflare deploy` detects it via `hasWranglerConfig()` — if the file is missing from git, the deploy step will fail with "Missing Cloudflare deployment setup: Wrangler config". Do not add `wrangler.json` to `.gitignore`.

## DNS and verification

Do not guess DNS targets. Register the application, admin, app and supported tenant wildcard hostnames with the selected hosting service, then copy the exact CNAME/A/TXT records it returns into the DNS provider. Preserve mail and unrelated verification records.

Before onboarding merchants, verify HTTPS, `/api/health`, Supabase Auth login, bootstrap removal, suspended tenants, cross-tenant reads/writes, anonymous checkout, R2 upload/download scope, tracking revocation, proof approval, and independent staff sessions on the deployed hostname. No production URL is claimed until those checks pass.
