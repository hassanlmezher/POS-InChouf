import type { Runtime } from './db';
import { fail } from './security';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthAdapter {
  signIn(email: string, password: string): Promise<AuthUser | null>;
  createUser(input: {
    email: string;
    password: string;
    name: string;
    role: string;
    tenantId: string | null;
  }): Promise<AuthUser>;
  updatePassword(userId: string, password: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

function authBase(env: Runtime) {
  if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL is required.');
  return env.SUPABASE_URL.replace(/\/$/, '');
}

async function authFetch<T>(
  env: Runtime,
  path: string,
  init: RequestInit,
  serviceRole = false,
) {
  const key = serviceRole
    ? env.SUPABASE_SERVICE_ROLE_KEY
    : env.SUPABASE_ANON_KEY;
  if (!key)
    throw new Error(
      `${serviceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY'} is required.`,
    );
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${authBase(env)}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      'Supabase Auth request failed.';
    if (res.status === 401 || res.status === 400) fail(401, message);
    throw new Error(message);
  }
  return data as T;
}

export function auth(env: Runtime): AuthAdapter {
  if (env.AUTH) return env.AUTH;
  return {
    signIn: async (email, password) => {
      try {
        const data = await authFetch<{ user?: AuthUser }>(
          env,
          '/auth/v1/token?grant_type=password',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          },
        );
        return data.user || null;
      } catch (e) {
        if (e instanceof Error && /invalid|login|credential/i.test(e.message))
          return null;
        throw e;
      }
    },
    createUser: async (input) => {
      const data = await authFetch<AuthUser>(
        env,
        '/auth/v1/admin/users',
        {
          method: 'POST',
          body: JSON.stringify({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
              name: input.name,
              role: input.role,
              tenant_id: input.tenantId,
            },
            app_metadata: {
              role: input.role,
              tenant_id: input.tenantId,
            },
          }),
        },
        true,
      );
      return data;
    },
    updatePassword: async (userId, password) => {
      await authFetch(
        env,
        `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: 'PUT',
          body: JSON.stringify({ password }),
        },
        true,
      );
    },
    deleteUser: async (userId) => {
      await authFetch(
        env,
        `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        { method: 'DELETE' },
        true,
      );
    },
  };
}
