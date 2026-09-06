import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
const credsPath = '.demo-credentials.json';
if (!existsSync(credsPath)) {
  const data = Object.fromEntries(
    ['admin', 'owner', 'picker', 'driver'].map((x) => [
      x,
      randomBytes(18).toString('base64url'),
    ]),
  );
  writeFileSync(credsPath, JSON.stringify(data, null, 2), { mode: 0o600 });
}
if (!existsSync('.dev.vars'))
  writeFileSync(
    '.dev.vars',
    `# Add SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the project dashboard.\n# SUPABASE_DATABASE_URL is needed only by npm run db:migrate.\nBOOTSTRAP_TOKEN=${randomBytes(32).toString('hex')}\nSITE_HOST=localhost\n`,
    { mode: 0o600 },
  );
console.log(
  'Private local credentials and bootstrap configuration are ready. Add the Supabase values to .dev.vars, restart the dev server, then run npm run db:migrate and npm run db:seed.',
);
