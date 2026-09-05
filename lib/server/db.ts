import type { User, Tenant } from '../types';
import { fail, hash, hostTenant, assertTenant } from './security';
export interface Runtime {
  DB: D1Database;
  FILES: R2Bucket;
  SITE_HOST?: string;
  BOOTSTRAP_TOKEN?: string;
}
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const stmt = (db: D1Database, sql: string, ...args: unknown[]) =>
  db.prepare(sql).bind(...args);
export const rows = async <T>(
  db: D1Database,
  sql: string,
  ...args: unknown[]
) => (await stmt(db, sql, ...args).all<T>()).results;
export const one = <T>(db: D1Database, sql: string, ...args: unknown[]) =>
  stmt(db, sql, ...args).first<T>();
export const event = (
  db: D1Database,
  tenantId: string,
  actor: string,
  action: string,
  orderId: string | null = null,
  detail = '',
  isPublic = false,
) =>
  stmt(
    db,
    'INSERT INTO events (id,tenantId,orderId,actor,action,detail,public,createdAt) VALUES (?,?,?,?,?,?,?,?)',
    uid(),
    tenantId,
    orderId,
    actor,
    action,
    detail,
    Number(isPublic),
    now(),
  );
export const platformEvent = (
  db: D1Database,
  actor: string,
  action: string,
  detail: string,
) =>
  stmt(
    db,
    'INSERT INTO platformEvents (id,actor,action,detail,createdAt) VALUES (?,?,?,?,?)',
    uid(),
    actor,
    action,
    detail,
    now(),
  );
export async function session(req: Request, env: Runtime) {
  const cookie = req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('op_session='))
    ?.slice(11);
  if (!cookie) fail(401, 'Please sign in.');
  const user = await one<User>(
    env.DB,
    'SELECT u.id,u.tenantId,u.name,u.email,u.role,u.active FROM users u JOIN sessions s ON s.userId=u.id WHERE s.id=? AND s.expires>? AND u.active=1',
    hash(cookie!),
    Date.now(),
  );
  if (!user) fail(401, 'Please sign in.');
  const slug = hostTenant(new URL(req.url).host);
  if (slug) {
    const tenant = await one<Tenant>(
      env.DB,
      'SELECT * FROM tenants WHERE slug=?',
      slug,
    );
    if (!tenant) fail(404, 'Store not found.');
    assertTenant(user!, tenant!.id);
  }
  if (user!.tenantId) {
    const t = await one<Tenant>(
      env.DB,
      'SELECT * FROM tenants WHERE id=?',
      user!.tenantId,
    );
    if (!t?.active || t.subscription === 'suspended')
      fail(403, 'Your business is suspended. Contact InChouf.');
  }
  return user!;
}
export async function publicTenant(req: Request, env: Runtime, slug: string) {
  if (
    hostTenant(new URL(req.url).host) &&
    hostTenant(new URL(req.url).host) !== slug
  )
    fail(404, 'Store not found.');
  const t = await one<Tenant>(
    env.DB,
    'SELECT * FROM tenants WHERE slug=? AND active=1 AND subscription != ?',
    slug,
    'suspended',
  );
  if (!t) fail(404, 'This store is not available.');
  return t!;
}
export async function rateLimit(
  req: Request,
  db: D1Database,
  scope: string,
  max: number,
) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const bucket = Math.floor(Date.now() / 600000);
  const key = hash(`${scope}:${ip}:${bucket}`);
  const result = await one<{ count: number }>(
    db,
    'INSERT INTO limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    key,
    Date.now() + 600000,
  );
  if (result!.count > max)
    fail(429, 'Too many requests. Please try again in ten minutes.');
  if (Math.random() < 0.02)
    await stmt(db, 'DELETE FROM limits WHERE expires<?', Date.now()).run();
}
