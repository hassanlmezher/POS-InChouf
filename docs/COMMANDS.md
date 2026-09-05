# Execution and reproduction commands

All project commands run in `/Users/hassanmezher/Desktop/Projects/inchoufPos`. Secrets never belong in command logs.

## Environment / original domain inspection

- `pwd`
- `ls -ld /Users/hassanmezher/Desktop/Projects/inchoufPos`
- `mkdir -p /Users/hassanmezher/Desktop/Projects/inchoufPos`
- `command -v node npm pnpm docker psql vercel ffmpeg`
- `node --version`
- `dig +short NS inchouf.com`
- `dig +short inchouf.com`
- `dig +short CNAME app.inchouf.com`
- `curl -I --max-time 15 https://inchouf.com`
- Relevant Sites skill files and generated configuration were read with `cat`/`rg`.
- Signed-in Chrome Vercel/Supabase pages were inspected through the browser tools.

## Scaffold / packages

- Existing Sites project configuration is retained with the R2 add-on; no D1 add-on is required.
- `npm install zod`
- `npm install -D tsx @playwright/test`
- Patched versions were set in `package.json`, then `npm install` resolved them together. Initial isolated updates hit peer conflicts and were not forced.
- `npm install -D wrangler@4.129.0 @cloudflare/workers-types@5.20260903.1`
- `npm view esbuild@0.25 version --json`
- A scoped esbuild override was added, followed by `npm install`.
- `npm audit --json`
- `npm audit --omit=dev --json`

## Database / demo

- `npm run db:generate`
- `npx drizzle-kit generate --custom --name=tenant_invariants`
- `SUPABASE_DATABASE_URL='postgresql://...' node scripts/migrate.mjs`
- `node scripts/setup-demo.mjs`
- `node scripts/seed.mjs`
- `SUPABASE_DATABASE_URL='postgresql://...' npm run db:migrate` (repeatable; applied files are recorded in `drizzle.schema_migrations`)

## Development / verification

- `npm run dev`
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`
- `curl -s http://localhost:3000/api/health`
- `npm run format -- --write` with authored source paths
- `npx oxlint --fix` (reviewed source fixes, not a forced dependency change)
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `npx playwright test -g 'Owner catalog'`
- `npx playwright test -g 'Custom proof'`
- `npm run build`
- `git init -b main`
- `git status --short`

## Assets

Verified image URLs were downloaded with `curl -L --fail --silent URL -o public/assets/NAME.jpg`. Exact source URLs are in `docs/ASSET-SOURCES.md`. `file public/assets/*` verified image formats. Browser tests captured local screenshots for mobile and desktop QA.

Deployment/version commands and final media rendering commands are recorded in their corresponding scripts and `DEPLOYMENT.md`/`video/README.md`. Connector operations use opaque IDs and short-lived credentials in memory; credentials are deliberately excluded here.
