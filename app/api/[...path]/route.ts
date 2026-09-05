import { env } from 'cloudflare:workers';
import { handle } from '@/lib/server/handler';
import type { Runtime } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
const endpoint = (req: Request) => handle(req, env as unknown as Runtime);
export { endpoint as GET, endpoint as POST, endpoint as PATCH };
