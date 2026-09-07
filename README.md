# InChouf OrderPilot

Independent multi-tenant storefront, order preparation and merchant-managed delivery software. Created at:

`/Users/hassanmezher/Desktop/Projects/inchoufPos`

## Local development

Requirements: Node.js 22.13+, npm, and Chrome for browser tests.

```sh
cd /Users/hassanmezher/Desktop/Projects/inchoufPos
npm ci
npm run demo:setup
# Put Supabase values from .env.example into .dev.vars first.
npm run db:migrate
npm run dev
# In a second terminal, bootstrap the first local Super Admin:
npm run db:seed
```

`npm run db:migrate` is repeatable and records applied files in `drizzle.schema_migrations`. `npm run db:seed` creates only the first Supabase Auth-backed Super Admin through the same one-time bootstrap path used in production.

- Marketing: http://localhost:3000/
- POS: http://localhost:3000/pos
- Login: http://localhost:3000/login
- Super Admin: http://localhost:3000/admin
- Internal demo: http://localhost:3000/store/internal-demo
- Tracking: private link returned after placing an order

The local bootstrap email defaults to `admin@demo.inchouf.test`, and its random password is in `.demo-credentials.json` (mode 0600, Git-ignored). There are no fixed source-code passwords. Demo tenant and staff fixtures are test-only data and must not be created through production bootstrap.

## Features

- Searchable active/suspended businesses, tenant logo branding, manual subscriptions and owner access resets.
- Independent password sessions and server-side employee role enforcement.
- Catalog, categories, pooled stock, variants, custom text and private file uploads.
- Searchable storefront, cart, account-free checkout, bounded manual order product search and COD/manual payment records.
- Atomic stock reservation, lifecycle transitions, assignments, audit trail and activity timeline.
- Picking/packing, customer-proof and delivery-exception queues.
- Merchant delivery zones, fees, thresholds, internal drivers, external couriers and cash settlements.
- Revocable customer tracking, versioned proof previews/approval and approved-version locking.
- Catalog CSV import/export, server-authorized order CSV export, customer search/profile history and bounded analytics.
- Lightweight polling keeps order, proof, delivery, customer and admin views fresh without manual page refreshes.
- Optional lightweight CSS 3D gallery with mobile/reduced-motion fallback.

## Configuration and docs

Set public platform contacts in `config/contact.ts`. Supabase provides PostgreSQL and Auth. The Worker keeps the existing private Cloudflare R2 `FILES` binding for uploads because it avoids a second file API and keeps signed access in one server boundary. No Meta, WhatsApp, SMS, gateway, courier, marketplace or AI service is required.

See `ARCHITECTURE.md`, `DEPLOYMENT.md`, `TESTING.md`, `docs/API.md`, `docs/PRODUCTION-CHECKLIST.md`, `docs/COMMANDS.md` and `docs/STATUS.md` for verified capabilities, commands, deployment state and remaining operational work.

The application uses the Next.js App Router API on Vinext/Cloudflare Workers with Supabase PostgreSQL/Auth and private R2. The current Vercel website was preserved. Production domains must not be described as live until DNS, certificates, access policy and actual URLs are verified.
