import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handle } from '../lib/server/handler';
import type { Runtime } from '../lib/server/db';
export function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const f of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(`drizzle/${f}`, 'utf8'));
  class Prepared {
    constructor(
      public sql: string,
      public args: unknown[] = [],
    ) {}
    bind(...args: unknown[]) {
      return new Prepared(this.sql, args);
    }
    async first() {
      return sqlite.prepare(this.sql).get(...(this.args as never[])) || null;
    }
    async all() {
      return {
        results: sqlite.prepare(this.sql).all(...(this.args as never[])),
        success: true,
        meta: { changes: 0 },
      };
    }
    async run() {
      const r = sqlite.prepare(this.sql).run(...(this.args as never[]));
      return {
        results: [],
        success: true,
        meta: { changes: Number(r.changes) },
      };
    }
  }
  const blobs = new Map<string, Uint8Array>();
  const env = {
    DB: {
      prepare: (s: string) => new Prepared(s),
      batch: async (statements: Prepared[]) => {
        sqlite.exec('BEGIN');
        try {
          const results = [];
          for (const s of statements) results.push(await s.run());
          sqlite.exec('COMMIT');
          return results;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      },
    },
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
    BOOTSTRAP_TOKEN: 'test-only-bootstrap-token',
    SITE_HOST: 'test.invalid',
  } as unknown as Runtime;
  async function request(
    path: string,
    method: string = 'GET',
    data?: unknown,
    cookie = '',
    host = 'http://test.invalid',
    origin = host,
  ) {
    return handle(
      new Request(`${host}/api/${path}`, {
        method,
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie,
          'CF-Connecting-IP': '127.0.0.1',
        },
        ...(method !== 'GET' && data !== undefined ? {body:JSON.stringify(data)} : {}),
      }),
      env,
    );
  }
  return { sqlite, env, request, blobs };
}
