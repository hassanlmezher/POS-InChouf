# InChouf OrderPilot architecture

## Runtime and boundaries

OrderPilot is one TypeScript/React application using the Next.js App Router API through Vinext. Vite builds it into a Cloudflare Worker. Supabase provides PostgreSQL and Auth; Cloudflare R2 remains the private file store. The API is same-origin, so sessions and CSRF protection stay in the Worker boundary.

The Worker uses Supabase's HTTP REST RPC endpoint for database calls because Cloudflare Workers do not provide a dependable raw PostgreSQL socket. Drizzle owns the PostgreSQL schema and generated migrations. scripts/migrate.mjs uses the Supabase transaction-pooler connection locally or in CI, while the Worker only needs the Supabase URL, service-role key and R2 binding.

## Layout

- app/: marketing, login, POS, Super Admin, storefront and private tracking routes.
- components/: role-aware workspaces, product editor, checkout, order detail, proof and delivery interfaces.
- lib/server/handler.ts: validated HTTP dispatch and authorization.
- lib/server/orders.ts: checkout pricing, stock reservation, state transitions and assignment validation.
- lib/server/security.ts: session/tracking token hashing, permission checks, hostname validation and CSRF checks.
- lib/server/supabase.ts: Supabase Auth REST integration for platform users.
- lib/server/db.ts: Worker-safe Supabase HTTP database adapter, session resolution, audit helpers and rate limiting.
- db/schema.ts and drizzle/: PostgreSQL schema, constraints, triggers and RLS policies.
- scripts/: local migration, bootstrap and demo maintenance.
- tests/: API tests against disposable PGlite PostgreSQL and Chrome end-to-end workflows.

## Authentication and tenant isolation

Super Admins, business owners, employees, pickers and drivers are Supabase Auth users. The public users table is the application profile keyed by the Supabase Auth user ID; it stores role, active state and tenant membership, but never a password. The Worker verifies credentials and manages users through Supabase Auth, then creates a short-lived HttpOnly application session whose database value is a SHA-256 hash.

The browser never selects the tenant for an authenticated API request. The session resolves an active profile, and that profile supplies the tenant ID. Tenant hostnames must also match the profile. Public storefront customers remain account-free and use only a revocable tracking capability.

Every tenant-owned table has tenantid and is protected in two ways: all Worker queries include tenant predicates and membership/assignment checks, while PostgreSQL enables RLS policies for direct Supabase API access. Policies use auth.uid() and the profile's active tenant/role. Composite foreign keys bind order lines, zones, employee assignments, files and proofs to the same tenant. The Worker uses the server-only service role through a private HTTP RPC, so no service key reaches the client and public PostgREST access cannot bypass these policies.

## Files, delivery and order consistency

R2 remains private because the existing upload/download implementation already validates file signatures, tenant/order scope and tracking capability. Keeping R2 avoids a second storage API and migration of existing object keys. Catalog images are public only through the controlled image route when attached to an active product in an active business.

Tenant branding uses the existing tenant settings document with a server-owned `branding.logoId`. Logos are stored in the tenant's R2 namespace and served only through a tenant-resolved storefront route; callers cannot request arbitrary logo IDs or object keys.

Checkout validates catalog data, options, required text, delivery zone, minimums and payment methods on the server. Integer cents avoid floating-point totals. PostgreSQL triggers reserve stock transactionally, restore it once on cancellation/return, enforce proof scope/locking and prevent packing before proof approval. SKU, idempotency and version checks protect duplicate and concurrent writes.

Delivery supports two explicit methods. Internal delivery requires an active owner or delivery manager assigned as `driverId`; external courier delivery records `deliveryMethod=external_courier` and an optional provider without forcing an InChouf user account. Cash reconciliation is modeled as immutable settlement batches for internal drivers or external providers. Settlement rows calculate expected COD from eligible delivered orders, record actual returned cash and variance, and a unique settlement-order constraint prevents accidental double settlement.

Operational views use lightweight polling rather than aggressive realtime subscriptions: order and proof queues refresh about every 15 seconds while visible, and admin/customer/audit/settlement lists refresh about every 30 seconds. Mutations still revalidate affected resources immediately after save.

## Operational choices

- Starter is one owner and up to two active employees.
- Payment methods, COD settlements and subscription status are manual; no online payment is processed.
- Public tracking exposes limited order data and supports account-free proof review.
- The application has no required messaging, courier, marketplace or AI integration.
- File retention and malware scanning remain operational responsibilities for production.
