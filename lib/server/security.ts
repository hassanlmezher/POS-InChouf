import { Buffer } from 'node:buffer';
import { scrypt, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import type { Role, Permission, User } from '../types';
import { rolePermissions } from '../types';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
export const token = () => Buffer.from(randomBytes(32)).toString('hex');
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const derive = (password: string, salt: string) =>
  new Promise<Uint8Array>((resolve, reject) =>
    scrypt(
      password,
      salt,
      32,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (e, k) => (e ? reject(e) : resolve(Buffer.from(k))),
    ),
  );
export async function passwordHash(password: string) {
  const salt = token();
  return `scrypt$${salt}$${Array.from(await derive(password, salt), b=>b.toString(16).padStart(2,'0')).join('')}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [, salt, value] = stored.split('$');
  if (!salt || !value) return false;
  const actual = await derive(password, salt);
  const expected = Buffer.from(value, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function allow(user: User, permission: Permission) {
  if (!rolePermissions[user.role]?.includes(permission))
    fail(403, 'You do not have permission for this action.');
}
export function requireRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role))
    fail(403, 'You do not have permission for this action.');
}
export const reserved = [
  'www',
  'app',
  'admin',
  'api',
  'mail',
  'support',
  'static',
  'assets',
];
export function hostTenant(host: string) {
  const hostname = host.toLowerCase().split(':')[0];
  if (hostname.endsWith('.inchouf.com')) {
    const slug = hostname.slice(0, -12);
    if (!reserved.includes(slug)) {
      if (!/^[a-z][a-z0-9-]{1,48}[a-z0-9]$/.test(slug))
        fail(400, 'Invalid store hostname.');
      return slug;
    }
  }
  return null;
}
export function validHost(host: string, siteHost?: string) {
  const h = host.toLowerCase().split(':')[0];
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'inchouf.com' ||
    h.endsWith('.inchouf.com') ||
    h === siteHost
  );
}
export function assertTenant(user: User, tenantId: string) {
  if (!user.tenantId || user.tenantId !== tenantId)
    fail(403, 'Store access denied.');
}
export function originGuard(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin)
    fail(403, 'Request origin is not allowed.');
}
