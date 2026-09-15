import { readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import postgres from 'postgres';

try {
  loadEnvFile('.env');
} catch {}
try {
  loadEnvFile('.dev.vars');
} catch {}

const email = (
  process.env.VARELYS_ADMIN_EMAIL || 'varelysperfumes@gmail.com'
).toLowerCase();
const password = process.env.VARELYS_ADMIN_PASSWORD;
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!supabaseUrl || !serviceRole || !databaseUrl) {
  console.error(
    'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DATABASE_URL are required.',
  );
  process.exit(1);
}

if (!password) {
  console.error('Set VARELYS_ADMIN_PASSWORD before running this script.');
  process.exit(1);
}

const authHeaders = {
  apikey: serviceRole,
  authorization: `Bearer ${serviceRole}`,
  'content-type': 'application/json',
};

async function authRequest(path, init = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: { ...authHeaders, ...init.headers },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message =
      data?.message ||
      data?.msg ||
      data?.error_description ||
      data?.error ||
      `Supabase Auth request failed with ${response.status}.`;
    throw new Error(message);
  }
  return data;
}

async function findUserByEmail() {
  const data = await authRequest(
    `/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
  );
  const users = Array.isArray(data?.users) ? data.users : [];
  return users.find((user) => user.email?.toLowerCase() === email) || null;
}

async function upsertAuthUser() {
  const existing = await findUserByEmail();
  if (existing?.id) {
    await authRequest(`/auth/v1/admin/users/${encodeURIComponent(existing.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: 'Varelys Perfumes Admin',
          role: 'owner',
          tenant_id: 'tenant_varelysperfumes',
        },
        app_metadata: {
          role: 'owner',
          tenant_id: 'tenant_varelysperfumes',
        },
      }),
    });
    return existing.id;
  }

  const created = await authRequest('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: 'Varelys Perfumes Admin',
        role: 'owner',
        tenant_id: 'tenant_varelysperfumes',
      },
      app_metadata: {
        role: 'owner',
        tenant_id: 'tenant_varelysperfumes',
      },
    }),
  });
  return created.id;
}

const userId = await upsertAuthUser();
const seed = readFileSync('supabase/varelys_seed.sql', 'utf8').replaceAll(
  '__SUPABASE_AUTH_USER_ID__',
  userId,
);

const sql = postgres(databaseUrl, { max: 1, prepare: false });
try {
  await sql.unsafe(seed);
} finally {
  await sql.end();
}

console.log(`Varelys Perfumes is ready. Admin email: ${email}`);
