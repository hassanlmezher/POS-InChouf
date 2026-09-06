import type { User, Tenant } from '../types';
import { fail, hash, hostTenant, assertTenant } from './security';
import { supabaseJsonHeaders } from './supabase-headers';

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

export interface Database {
  execute<T = unknown>(sql: string, args?: unknown[]): Promise<QueryResult<T>>;
  batch(statements: Statement[]): Promise<BatchResult[]>;
}

export interface Runtime {
  databaseOverride?: Database;
  FILES: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AUTH?: import('./supabase').AuthAdapter;
  SITE_HOST?: string;
  BOOTSTRAP_TOKEN?: string;
}

export interface BatchResult {
  results: unknown[];
  success: true;
  meta: { changes: number };
}

const keyMap: Record<string, string> = {
  tenantid: 'tenantId',
  orderid: 'orderId',
  productid: 'productId',
  userid: 'userId',
  zoneid: 'zoneId',
  employeeid: 'employeeId',
  driverid: 'driverId',
  fileid: 'fileId',
  lowstock: 'lowStock',
  customfields: 'customFields',
  freeabove: 'freeAbove',
  paymentmethod: 'paymentMethod',
  deliveryfee: 'deliveryFee',
  deliverystatus: 'deliveryStatus',
  cashcollected: 'cashCollected',
  trackinghash: 'trackingHash',
  trialstart: 'trialStart',
  trialend: 'trialEnd',
  renewaldate: 'renewalDate',
  suspendeddate: 'suspendedDate',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
  contenttype: 'contentType',
  ordercount: 'orderCount',
  usercount: 'userCount',
  lastorder: 'lastOrder',
};

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();

function bindParams(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row))
    out[keyMap[key.toLowerCase()] || key] = value;
  return out as T;
}

function normalizeRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => normalizeRow<T>(row));
}

function createSupabaseDatabase(env: Runtime): Database {
  const endpoint = `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc`;
  const headers = supabaseJsonHeaders(env.SUPABASE_SERVICE_ROLE_KEY);
  const rpc = async <T>(name: string, body: unknown): Promise<T> => {
    const response = await fetch(`${endpoint}/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(`Supabase database request failed (${response.status}).`);
    return (await response.json()) as T;
  };
  const execute = async <T = unknown>(
    text: string,
    args: unknown[] = [],
  ): Promise<QueryResult<T>> => {
    const result = await rpc<{
      rows: Record<string, unknown>[];
      count: number;
    }>('op_query', { p_sql: bindParams(text), p_params: args });
    return {
      rows: normalizeRows<T>(result.rows || []),
      rowCount: Number(result.count || 0),
    };
  };
  return {
    execute,
    batch: async (statements) => {
      const result = await rpc<BatchResult[]>('op_batch', {
        p_statements: statements.map((s) => ({
          sql: bindParams(s.sql),
          params: s.args,
        })),
      });
      return result.map((item) => ({
        ...item,
        results: normalizeRows(item.results as Record<string, unknown>[]),
      }));
    },
  };
}

let cachedUrl = '';
let cachedDb: Database | null = null;

export function database(env: Runtime) {
  if (env.databaseOverride) return env.databaseOverride;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Supabase database credentials are required.');
  const cacheKey = `${env.SUPABASE_URL}:${env.SUPABASE_SERVICE_ROLE_KEY}`;
  if (!cachedDb || cachedUrl !== cacheKey) {
    cachedUrl = cacheKey;
    cachedDb = createSupabaseDatabase(env);
  }
  return cachedDb;
}

export class Statement {
  constructor(
    public db: Database,
    public sql: string,
    public args: unknown[] = [],
  ) {}
  bind(...args: unknown[]) {
    return new Statement(this.db, this.sql, args);
  }
  async first<T>() {
    return (await this.db.execute<T>(this.sql, this.args)).rows[0] || null;
  }
  async all<T>() {
    const result = await this.db.execute<T>(this.sql, this.args);
    return {
      results: result.rows,
      success: true,
      meta: { changes: result.rowCount },
    };
  }
  async run() {
    const result = await this.db.execute(this.sql, this.args);
    return {
      results: result.rows,
      success: true,
      meta: { changes: result.rowCount },
    };
  }
}

export const stmt = (db: Database, sql: string, ...args: unknown[]) =>
  new Statement(db, sql, args);
export const rows = async <T>(db: Database, sql: string, ...args: unknown[]) =>
  (await stmt(db, sql, ...args).all<T>()).results;
export const one = <T>(db: Database, sql: string, ...args: unknown[]) =>
  stmt(db, sql, ...args).first<T>();
export const event = (
  db: Database,
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
  db: Database,
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
  const db = database(env);
  const cookie = req.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('op_session='))
    ?.slice(11);
  if (!cookie) fail(401, 'Please sign in.');
  const user = await one<User>(
    db,
    'SELECT u.id,u.tenantId,u.name,u.email,u.role,u.active FROM users u JOIN sessions s ON s.userId=u.id WHERE s.id=? AND s.expires>? AND u.active=1',
    hash(cookie!),
    Date.now(),
  );
  if (!user) fail(401, 'Please sign in.');
  const slug = hostTenant(new URL(req.url).host);
  if (slug) {
    const tenant = await one<Tenant>(
      db,
      'SELECT * FROM tenants WHERE slug=?',
      slug,
    );
    if (!tenant) fail(404, 'Store not found.');
    assertTenant(user!, tenant!.id);
  }
  if (user!.tenantId) {
    const t = await one<Tenant>(
      db,
      'SELECT * FROM tenants WHERE id=?',
      user!.tenantId,
    );
    if (!t?.active || t.subscription === 'suspended')
      fail(403, 'Your business is suspended. Contact InChouf.');
  }
  return user!;
}
export async function publicTenant(req: Request, env: Runtime, slug: string) {
  const db = database(env);
  if (
    hostTenant(new URL(req.url).host) &&
    hostTenant(new URL(req.url).host) !== slug
  )
    fail(404, 'Store not found.');
  const t = await one<Tenant>(
    db,
    'SELECT * FROM tenants WHERE slug=? AND active=1 AND subscription != ?',
    slug,
    'suspended',
  );
  if (!t) fail(404, 'This store is not available.');
  return t!;
}
export async function rateLimit(
  req: Request,
  db: Database,
  scope: string,
  max: number,
) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const bucket = Math.floor(Date.now() / 600000);
  const key = hash(`${scope}:${ip}:${bucket}`);
  const result = await one<{ count: number }>(
    db,
    'INSERT INTO limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=limits.count+1 RETURNING count',
    key,
    Date.now() + 600000,
  );
  if (result!.count > max)
    fail(429, 'Too many requests. Please try again in ten minutes.');
  if (Math.random() < 0.02)
    await stmt(db, 'DELETE FROM limits WHERE expires<?', Date.now()).run();
}
