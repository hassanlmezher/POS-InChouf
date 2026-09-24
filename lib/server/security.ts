import { Buffer } from 'node:buffer';
import { randomBytes, createHash } from 'node:crypto';
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
export const temporaryWorkerHost = 'pos-inchouf.hassanmezher084.workers.dev';
export const publicStoreSlug = 'varelysperfumes';
export const publicStoreHost = 'perfume.inchouf.com';
export const publicStoreHosts = [publicStoreHost, `${publicStoreSlug}.inchouf.com`];
export const adminHost = 'admin.inchouf.com';

export function hostTenant(host: string) {
  const hostname = host.toLowerCase().split(':')[0];
  if (publicStoreHosts.includes(hostname)) return publicStoreSlug;
  return null;
}

export function validHost(host: string, siteHost?: string) {
  const h = host.toLowerCase().split(':')[0];
  const configuredHost = siteHost?.toLowerCase().split(':')[0];
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === 'inchouf.com' ||
    h === 'www.inchouf.com' ||
    h === adminHost ||
    publicStoreHosts.includes(h) ||
    h === configuredHost ||
    h === temporaryWorkerHost
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
