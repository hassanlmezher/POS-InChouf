import { readFileSync } from 'node:fs';
const base = process.env.APP_URL || 'http://localhost:3000';
const key = readFileSync('.dev.vars', 'utf8').match(
  /BOOTSTRAP_TOKEN=(.*)/,
)?.[1];
const r = await fetch(`${base}/api/bootstrap`, {
  method: 'POST',
  headers: {
    Origin: base,
    'Content-Type': 'application/json',
    'X-Bootstrap-Token': key,
  },
  body: readFileSync('.demo-credentials.json', 'utf8'),
});
const value = await r.json();
if (!r.ok) throw new Error(value.error);
console.log(
  'Internal demo tenant and four accounts seeded. Credentials are in .demo-credentials.json (local only).',
);
