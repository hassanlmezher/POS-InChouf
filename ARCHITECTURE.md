# InChouf OrderPilot architecture

## Runtime and boundaries

OrderPilot is one TypeScript/React application using the Next.js App Router API through Vinext. Vite builds it into a Cloudflare Worker. Sites provides the isolated deployment, D1 database and private R2 bucket. There is no separate API host requirement: `/api` is same-origin, which also keeps sessions and CSRF protection simple.

The existing `inchouf.com` Vercel deployment was inspected, not overwritten. The visible Supabase project was unrelated. This checkout uses the requested Sites capabilities rather than adding credentials or modifying unrelated infrastructure. D1 is SQLite, not PostgreSQL. It has no row-level security policy feature. Tenant-scoped prepared queries, relational constraints, server membership checks and adversarial tests are the isolation boundaries. Migrating to PostgreSQL would require a database adapter, SQL migration conversion and RLS policies; this repository does not claim to have PostgreSQL configured.

## Layout

- `app/`: marketing, login, POS, Super Admin, storefront and private tracking routes.
- `components/`: role-aware workspaces, product editor, checkout, order detail, proof and delivery interfaces.
- `lib/server/handler.ts`: validated HTTP dispatch and authorization.
- `lib/server/orders.ts`: checkout pricing, stock reservation, state transitions and assignment validation.
- `lib/server/security.ts`: password hashing, tokens, permission checks, hostname validation and CSRF checks.
- `lib/server/db.ts`: durable data access, session resolution, audit helpers and rate limiting.
- `db/schema.ts`, `drizzle/`: schema and versioned SQL migrations, including constraint triggers.
- `config/contact.ts`: the only public platform contact configuration.
- `scripts/`: local setup, bootstrap and database maintenance.
- `tests/`: actual API handlers exercised against SQLite, plus Chrome end-to-end workflows.

## Tenant isolation

The browser never selects the tenant for an authenticated API request. A random opaque session cookie resolves to an active user; that user's server-stored membership supplies the tenant ID. A tenant hostname must also match that membership. Public APIs resolve an active tenant from the validated slug; a tenant hostname and path slug must agree.

All business reads and writes use a tenant predicate. Composite foreign keys bind order lines, delivery zones, employee assignments, files and proofs to the same tenant. Database triggers reject foreign proof files and enforce stock/proof invariants. Platform administrators manage tenant metadata and account access through separate endpoints; they do not implicitly impersonate business owners.

## Authentication and files

Passwords use salted scrypt (N=32768, r=8, p=3). Only hashed 256-bit session and tracking tokens are stored. Cookies are HttpOnly, SameSite=Strict, host-only, Secure on HTTPS, and expire after eight hours. Password changes and access resets revoke sessions. Suspension and employee deactivation take effect on every server request. All mutations require an exact matching Origin header.

Tracking links are bearer capabilities: a holder may view the limited timeline, upload order files and decide on the latest proof. They expose neither the customer's address/phone nor staff/private audit details. Owners can revoke or rotate them. Referrer policy and no-store responses reduce link disclosure.

R2 is private. File downloads require tenant membership/assignment or the corresponding tracking token. Catalog images become public only when assigned to an active product of an active business. PNG/JPEG/PDF uploads have signature validation and a streamed 5 MB limit. PDFs download as attachments; image proofs can preview inline with nosniff and a sandbox CSP. There is no malware scanning service in V1; production operators should consider one for higher-risk file workflows.

## Order consistency

Checkout validates the catalog, options, required text, zone, minimum and payment method on the server. Integer cents avoid floating-point totals. A D1 transactional batch inserts the order, lines and audit event. Stock triggers reserve each line and abort the entire batch on insufficient inventory. Cancellation/return restores inventory once. SKU and idempotency constraints prevent duplicate records. Updates use an order version to reject concurrent stale writes. Financial status, cash collection and order status remain explicit, separate records.

Options have their own price and SKU label, and share the parent product's stock pool in V1. Customers upload custom artwork after checkout via their tracking page. Proofs have immutable version numbers; an approved version is locked. Orders with proofs cannot be packed until a proof is approved. This is not a manufacturing ERP or independent variant-bin inventory system.

## Operational choices

- Starter is one owner and up to two active employees. A delivery employee consumes one of those two seats.
- Payment methods and subscription status are manually configured; no payment is processed online.
- Current order lists/analytics display the latest 500 records and clearly label that limit. Customer grouping uses the supplied phone number; it is not identity verification.
- Catalog CSV imports validate each row and report partial progress on failure. Exports neutralize spreadsheet formulas.
- The optional 3D Experience is CSS perspective on product-photo planes, not a full 3D product model. It adds no WebGL/Three.js dependency. Mobile, reduced-motion and low-core devices use the standard gallery. Checkout is unchanged.
- The core works without Meta, WhatsApp, SMS, payment, courier, marketplace or AI APIs. Existing hosting/database infrastructure is the only operational service dependency.

## Remaining operational hardening

Before onboarding real merchants: load-test expected traffic, choose backup/restore retention, arrange support/contact details, review privacy/retention policies, and test the actual wildcard-domain/certificate arrangement. Files have no automated retention cleanup yet. D1 rate limiting relies on trusted platform-overwritten client IP headers in production; reverse proxies must not forward client-forged IP headers unchanged. Logs avoid request bodies, passwords and raw private tokens.
