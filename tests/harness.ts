import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { handle } from '../lib/server/handler';
import type { Database, Runtime } from '../lib/server/db';
import type { AuthAdapter, AuthUser } from '../lib/server/supabase';

function bindParams(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
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
  deliverymethod: 'deliveryMethod',
  deliveryprovider: 'deliveryProvider',
  cashcollected: 'cashCollected',
  trackinghash: 'trackingHash',
  trialstart: 'trialStart',
  trialend: 'trialEnd',
  renewaldate: 'renewalDate',
  suspendeddate: 'suspendedDate',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
  owneremail: 'ownerEmail',
  activecount: 'activeCount',
  suspendedcount: 'suspendedCount',
  monthlyvalue: 'monthlyValue',
  periodstart: 'periodStart',
  periodend: 'periodEnd',
  createdby: 'createdBy',
  settlementid: 'settlementId',
};

function normalize<T>(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row))
      out[keyMap[key.toLowerCase()] || key] = value;
    return out as T;
  });
}

function createAuth(): AuthAdapter {
  const users = new Map<string, AuthUser & { password: string }>();
  return {
    signIn: async (email, password) => {
      const user = Array.from(users.values()).find((u) => u.email === email);
      return user?.password === password
        ? { id: user.id, email: user.email }
        : null;
    },
    createUser: async (input) => {
      const exists = Array.from(users.values()).some(
        (u) => u.email === input.email,
      );
      if (exists) throw new Error('User already registered');
      const user = {
        id: crypto.randomUUID(),
        email: input.email,
        password: input.password,
      };
      users.set(user.id, user);
      return { id: user.id, email: user.email };
    },
    updatePassword: async (userId, password) => {
      const user = users.get(userId);
      if (!user) throw new Error('User not found');
      user.password = password;
    },
    deleteUser: async (userId) => {
      users.delete(userId);
    },
  };
}

export async function harness() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid AS $$
    BEGIN
      RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
  for (const f of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const statements = readFileSync(`drizzle/${f}`, 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) await pg.exec(statement);
  }
  const db: Database = {
    execute: async <T>(sql: string, args: unknown[] = []) => {
      const result = await pg.query<T>(bindParams(sql), args as never[]);
      return {
        rows: normalize<T>(result.rows as Record<string, unknown>[]),
        rowCount:
          typeof result.affectedRows === 'number'
            ? result.affectedRows
            : result.rows.length,
      };
    },
    batch: async (statements) => {
      await pg.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) {
          const result = await pg.query(
            bindParams(statement.sql),
            statement.args as never[],
          );
          results.push({
            results: normalize(result.rows as Record<string, unknown>[]),
            success: true as const,
            meta: {
              changes:
                typeof result.affectedRows === 'number'
                  ? result.affectedRows
                  : result.rows.length,
            },
          });
        }
        await pg.exec('COMMIT');
        return results;
      } catch (e) {
        await pg.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const blobs = new Map<string, Uint8Array>();
  const env = {
    databaseOverride: db,
    FILES: {
      put: async (key: string, data: Uint8Array) => {
        blobs.set(key, data);
      },
      get: async (key: string) =>
        blobs.has(key) ? { body: blobs.get(key) } : null,
      delete: async (key: string) => {
        blobs.delete(key);
      },
    },
    AUTH: createAuth(),
    BOOTSTRAP_TOKEN: 'test-only-bootstrap-token',
    SITE_HOST: 'test.invalid',
    SUPABASE_URL: 'http://supabase.test',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  } as unknown as Runtime;
  async function get<T>(sql: string, ...args: unknown[]) {
    return (await db.execute<T>(sql, args)).rows[0] || null;
  }
  async function all<T>(sql: string, ...args: unknown[]) {
    return (await db.execute<T>(sql, args)).rows;
  }
  async function run(sql: string, ...args: unknown[]) {
    return db.execute(sql, args);
  }
  async function request(
    path: string,
    method: string = 'GET',
    data?: unknown,
    cookie = '',
    host = 'http://test.invalid',
    origin = host,
    extraHeaders: Record<string, string> = {},
  ) {
    const multipart =
      typeof FormData !== 'undefined' && data instanceof FormData;
    const headers: Record<string, string> = {
      Origin: origin,
      Cookie: cookie,
      'CF-Connecting-IP': '127.0.0.1',
      ...extraHeaders,
    };
    if (!multipart) headers['Content-Type'] = 'application/json';
    return handle(
      new Request(`${host}/api/${path}`, {
        method,
        headers,
        ...(method !== 'GET' && data !== undefined
          ? { body: multipart ? (data as BodyInit) : JSON.stringify(data) }
          : {}),
      }),
      env,
    );
  }
  return { db, env, request, blobs, get, all, run };
}
