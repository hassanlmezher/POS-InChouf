# InChouf OrderPilot

Independent multi-tenant storefront, order preparation and merchant-managed delivery software. Created at:

`/Users/hassanmezher/Desktop/Projects/inchoufPos`

## Local development

Requirements: Node.js 22.13+, npm, and Chrome for browser tests.

```sh
cd /Users/hassanmezher/Desktop/Projects/inchoufPos
npm ci
npm run demo:setup
npm run db:migrate
npm run dev
# Once the server is running, in a second terminal:
npm run db:seed
```

The existing local installation has already been migrated and seeded. Start it with `npm run dev`; do not seed it again. Bootstrap refuses a nonempty users table.

- Marketing: http://localhost:3000/
- POS: http://localhost:3000/pos
- Login: http://localhost:3000/login
- Super Admin: http://localhost:3000/admin
- Internal demo: http://localhost:3000/store/internal-demo
- Tracking: private link returned after placing an order

Demo account emails: `admin@demo.inchouf.test`, `owner@demo.inchouf.test`, `picker@demo.inchouf.test`, `driver@demo.inchouf.test`. Random passwords are in `.demo-credentials.json` (mode 0600, Git-ignored). There are no fixed source-code passwords. These accounts and the sole demo tenant are for internal testing only.

## Features

- Active/suspended businesses, manual subscriptions and owner access resets.
- Independent password sessions and server-side employee role enforcement.
- Catalog, categories, pooled stock, variants, custom text and private file uploads.
- Searchable storefront, cart, account-free checkout, manual orders and COD/manual payment records.
- Atomic stock reservation, lifecycle transitions, assignments, audit trail and activity timeline.
- Picking/packing, customer-proof and delivery-exception queues.
- Merchant delivery zones, fees, thresholds, driver assignments and cash collection.
- Revocable customer tracking, versioned proof previews/approval and approved-version locking.
- Catalog CSV import/export, order CSV export, customer history and bounded analytics.
- Optional lightweight CSS 3D gallery with mobile/reduced-motion fallback.

## Configuration and docs

Set public platform contacts in `config/contact.ts`. The environment example documents private bootstrap configuration; Sites manages hosted DB and FILES bindings. No Meta, WhatsApp, SMS, gateway, courier, marketplace or AI service is required.

See `ARCHITECTURE.md`, `DEPLOYMENT.md`, `TESTING.md`, `docs/API.md`, `docs/PRODUCTION-CHECKLIST.md`, `docs/COMMANDS.md` and `docs/STATUS.md` for verified capabilities, commands, deployment state and remaining operational work.

The application uses the Next.js App Router API on Vinext/Cloudflare with D1 (SQLite), not a configured PostgreSQL/Vercel backend. The current Vercel website was preserved. Production domains must not be described as live until DNS, certificates, access policy and actual URLs are verified.
