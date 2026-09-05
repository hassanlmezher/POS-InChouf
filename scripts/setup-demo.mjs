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
    `BOOTSTRAP_TOKEN=${randomBytes(32).toString('hex')}\nSITE_HOST=inchouf-orderpilot.copper-goat-7392.chatgpt.site\n`,
    { mode: 0o600 },
  );
console.log(
  'Private demo credentials and bootstrap configuration are ready. Restart the dev server, then run npm run db:seed.',
);
