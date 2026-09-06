import { readFileSync } from 'node:fs';
const base = process.env.APP_URL || 'http://localhost:3000';
const key = readFileSync('.dev.vars', 'utf8').match(
  /BOOTSTRAP_TOKEN=(.*)/,
)?.[1];
const credentials = JSON.parse(readFileSync('.demo-credentials.json', 'utf8'));
const r = await fetch(`${base}/api/bootstrap`, {
  method: 'POST',
  headers: {
    Origin: base,
    'Content-Type': 'application/json',
    'X-Bootstrap-Token': key,
  },
  body: JSON.stringify({
    email: process.env.BOOTSTRAP_EMAIL || 'admin@demo.inchouf.test',
    password: credentials.admin,
    name: process.env.BOOTSTRAP_NAME || 'Platform Admin',
  }),
});
const value = await r.json();
if (!r.ok) throw new Error(value.error);
console.log(
  'Platform admin bootstrapped. The local password is in .demo-credentials.json.',
);
