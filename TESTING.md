# Testing OrderPilot

Use Node 22.13+ and Chrome. Run commands from `/Users/hassanmezher/Desktop/Projects/inchoufPos`.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run dev
# In a second terminal, with the internal demo seeded:
npm run test:e2e
npm run build
npm audit
```

`npm test` exercises the production request handler against disposable PGlite PostgreSQL with every migration and trigger applied. Fixtures create a second tenant only inside the disposable test database. No real business is provisioned by tests.

Coverage includes cross-tenant product/order access, PostgreSQL composite foreign keys, server pricing, stock rollback, duplicate checkout, state transitions, optimistic concurrency, exactly-once stock restoration, Supabase Auth adapter behavior, suspended businesses, expired sessions, CSRF, private tracking, proof scope/locks and CSV injection defenses. The test harness uses an in-memory Auth adapter because tests never contact a real Supabase project.

Chrome end-to-end tests use the safe local internal demo. They cover customer checkout, order appearance in POS, tracking updates, catalog creation, role-specific menus, admin controls, mobile overflow, mobile checkout, reduced-motion fallback, proof approval, picker/packer actions and driver delivery. They intentionally create clearly labelled internal test orders/products. Do not point these tests at real merchant data. Passwords come from ignored `.demo-credentials.json` and are never committed.

Browser test screenshots are in `docs/screenshots/`; failure traces and the HTML report are ignored. Server builds and test logs are under `docs/`. Security tests run without hosting credentials. Browser tests need the local dev server and seed data. The final report records the actual last run results; the existence of a test file alone is not a passing result.

The lint configuration excludes generated/vendor UI primitives. Framework-specific suggestions to replace normal links and local optimized images are disabled because full navigation is intentional between application surfaces. React Compiler rules are disabled because this project does not enable that compiler. Core TypeScript, hook correctness, accessibility and unused-code checks remain enabled.

The inherited Drizzle tooling pulled an obsolete esbuild release with a development-server advisory. A scoped override pins its esbuild to 0.25.12. The schema generator is explicitly checked after this override. Dependency versions also update React Server Components, Vinext, Vite and Cloudflare tooling to patched releases.

WebMCP catalog filtering is feature-detected and optional. A browser without the proposed registry simply uses the ordinary search field. A supported WebMCP tool execution context has not been verified; this is not required for checkout or staff operations.
