import {
  z,
  body,
  loginInput,
  tenantInput,
  staffInput,
  productInput,
  zoneInput,
  checkoutInput,
  updateOrderInput,
  settingsInput,
  settlementInput,
} from './validation';
import {
  type Runtime,
  database,
  one,
  rows,
  stmt,
  event,
  platformEvent,
  session,
  publicTenant,
  rateLimit,
  uid,
  now,
} from './db';
import {
  HttpError,
  fail,
  hash,
  token,
  allow,
  requireRole,
  originGuard,
  validHost,
} from './security';
import { auth } from './supabase';
import { placeOrder, orderDetail, updateOrder } from './orders';
import { exportCSV } from '../csv';
import {
  type Tenant,
  type User,
  type Order,
  defaultSettings,
  settingsOf,
} from '../types';
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    },
  });
class StageError extends Error {
  constructor(
    public stage: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : 'Operation failed.');
    this.name = cause instanceof Error ? cause.name : 'Error';
    this.cause = cause;
  }
}
async function stage<T>(name: string, work: Promise<T>) {
  try {
    return await work;
  } catch (e) {
    if (
      e instanceof HttpError ||
      e instanceof z.ZodError ||
      e instanceof SyntaxError
    )
      throw e;
    throw new StageError(name, e);
  }
}
const cookie = (req: Request, value: string, age: number) =>
  `op_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;

type UploadPayload = {
  data: Uint8Array;
  name: string;
  type: 'image/jpeg' | 'image/png' | 'application/pdf';
  size: number;
};

function safeName(input: string) {
  let decoded = input || 'upload';
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  return decoded.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'upload';
}

function detectUploadType(data: Uint8Array) {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return 'image/jpeg' as const;
  if (data.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10')
    return 'image/png' as const;
  if (new TextDecoder().decode(data.slice(0, 5)) === '%PDF-')
    return 'application/pdf' as const;
  return '';
}

function validateUpload(
  data: Uint8Array,
  name: string,
  orderId: string | null,
): UploadPayload {
  if (!data.length) fail(400, 'Choose a file.');
  if (data.length > 5 * 1024 * 1024) fail(413, 'File must be smaller than 5 MB.');
  const detected = detectUploadType(data);
  if (!detected || (!orderId && detected === 'application/pdf'))
    fail(400, 'Use a PNG or JPEG image, or a PDF for an order.');
  const type = detected as UploadPayload['type'];
  return { data, name: safeName(name), type, size: data.length };
}

async function filePayload(file: File, orderId: string | null) {
  return validateUpload(
    new Uint8Array(await file.arrayBuffer()),
    file.name,
    orderId,
  );
}

async function tenantCreateBody(req: Request) {
  if (!req.headers.get('content-type')?.includes('multipart/form-data'))
    return {
      input: await body(req, tenantInput),
      logo: null as UploadPayload | null,
  };
  const form = await req.formData();
  const field = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : '';
  };
  const values = {
    name: field('name'),
    slug: field('slug'),
    ownerName: field('ownerName'),
    email: field('email'),
    password: field('password'),
  };
  const rawLogo = form.get('logo');
  const logo = rawLogo instanceof File && rawLogo.size ? await filePayload(rawLogo, null) : null;
  return { input: tenantInput.parse(values), logo };
}
export async function handle(req: Request, env: Runtime): Promise<Response> {
  try {
    if (
      !validHost(
        new URL(req.url).host,
        env.SITE_HOST || 'inchouf-orderpilot.copper-goat-7392.chatgpt.site',
      )
    )
      fail(400, 'Unrecognized hostname.');
    if (!['GET', 'HEAD'].includes(req.method)) originGuard(req);
    return await route(req, env);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        },
        400,
      );
    if (e instanceof SyntaxError) return json({ error: 'Invalid JSON.' }, 400);
    const message = e instanceof Error ? e.message : '';
    if (new URL(req.url).hostname === 'localhost') console.error(e);
    if (/INSUFFICIENT_STOCK|stock_nonnegative/.test(message))
      return json(
        {
          error:
            'Stock changed. Please reduce the quantity or refresh your cart.',
        },
        409,
      );
    if (/PROOF_|FILE_SCOPE/.test(message))
      return json(
        {
          error:
            'Proof approval is required, locked, or references an invalid file.',
        },
        409,
      );
    if (/EMPLOYEE_LIMIT/.test(message))
      return json(
        { error: 'Starter supports up to two active employees.' },
        409,
      );
    if (/UNIQUE constraint|duplicate key value/.test(message))
      return json(
        { error: 'That email, SKU, slug or request already exists.' },
        409,
      );
    if (/BODY_TOO_LARGE/.test(message))
      return json({ error: 'Request too large.' }, 413);
    const failedStage = e instanceof StageError ? e.stage : '';
    console.error(
      'OrderPilot request failed',
      new URL(req.url).pathname.replace(/\/[a-f0-9]{64}/g, '/[private]'),
      e instanceof Error ? e.name : 'Error',
      failedStage ? `stage=${failedStage}` : '',
    );
    try {
      await platformEvent(
        database(env),
        'System',
        'Request error',
        `${req.method} ${new URL(req.url).pathname.split('/').slice(0, 3).join('/')} · ${e instanceof Error ? e.name : 'Error'}${failedStage ? ` · ${failedStage}` : ''}`,
      ).run();
    } catch {}
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
async function route(req: Request, env: Runtime): Promise<Response> {
  const db = database(env);
  const url = new URL(req.url);
  const p = url.pathname.split('/').filter(Boolean).slice(1);
  const method = req.method;
  if (p[0] === 'health' && method === 'GET') {
    await one(db, 'SELECT 1');
    return json({ status: 'ok', database: 'connected' });
  }
  if (p[0] === 'bootstrap' && method === 'POST') {
    if (
      !env.BOOTSTRAP_TOKEN ||
      hash(req.headers.get('x-bootstrap-token') || '') !==
        hash(env.BOOTSTRAP_TOKEN)
    )
      fail(404, 'Not found.');
    const input = await body(
      req,
      z
        .object({
          email: z.email().transform((x) => x.toLowerCase()),
          password: z.string().min(16).max(128),
          name: z.string().trim().min(2).max(100).default('Platform Admin'),
        })
        .strict(),
    );
    if (
      await one(
        db,
        "SELECT id FROM users WHERE tenantId IS NULL OR role='super_admin' LIMIT 1",
      )
    )
      fail(409, 'Bootstrap has already been completed.');
    const created = await auth(env).createUser({
      email: input.email,
      password: input.password,
      name: input.name,
      role: 'super_admin',
      tenantId: null,
    });
    try {
      await db.batch([
        stmt(
          db,
          'INSERT INTO users (id,tenantId,email,name,role,createdAt) VALUES (?,?,?,?,?,?)',
          created.id,
          null,
          input.email,
          input.name,
          'super_admin',
          now(),
        ),
        platformEvent(
          db,
          input.name,
          'Platform bootstrap completed',
          input.email,
        ),
      ]);
    } catch (e) {
      await auth(env)
        .deleteUser(created.id)
        .catch(() => {});
      throw e;
    }
    return json(
      { ok: true, user: { email: input.email, role: 'super_admin' } },
      201,
    );
  }
  if (p[0] === 'login' && method === 'POST') {
    await stage('login.rate_limit', rateLimit(req, db, 'login', 10));
    const input = await body(req, loginInput);
    const signedIn = await stage(
      'login.supabase_auth',
      auth(env).signIn(input.email, input.password),
    );
    if (!signedIn) fail(401, 'Email or password is incorrect.');
    const user = await stage(
      'login.profile_lookup',
      one<User>(
        db,
        'SELECT id,tenantId,email,name,role,active FROM users WHERE id=? AND active=1',
        signedIn!.id,
      ),
    );
    if (!user) fail(401, 'Email or password is incorrect.');
    if (user!.tenantId) {
      const t = await stage(
        'login.tenant_lookup',
        one<Tenant>(db, 'SELECT * FROM tenants WHERE id=?', user!.tenantId),
      );
      if (!t?.active || t.subscription === 'suspended')
        fail(403, 'Your business is suspended.');
    }
    const raw = token();
    await stage(
      'login.session_create',
      db.batch([
        stmt(db, 'DELETE FROM sessions WHERE expires<?', Date.now()),
        stmt(
          db,
          'INSERT INTO sessions (id,userId,expires) VALUES (?,?,?)',
          hash(raw),
          user!.id,
          Date.now() + 8 * 3600000,
        ),
      ]),
    );
    return json({ role: user!.role }, 200, {
      'Set-Cookie': cookie(req, raw, 8 * 3600),
    });
  }
  if (p[0] === 'logout' && method === 'POST') {
    const u = await session(req, env);
    await stmt(db, 'DELETE FROM sessions WHERE userId=?', u.id).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, '', 0) });
  }
  if (p[0] === 'store') {
    const tenant = await publicTenant(req, env, p[1] || '');
    if (p.length === 2 && method === 'GET') {
      return json({
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings,
        },
        products: await rows(
          db,
          'SELECT id,name,description,category,sku,price,stock,lowStock,image,variants,customFields,active FROM products WHERE tenantId=? AND active=1 ORDER BY name',
          tenant.id,
        ),
        zones: await rows(
          db,
          'SELECT id,name,fee,freeAbove,minimum,notes,active FROM zones WHERE tenantId=? AND active=1',
          tenant.id,
        ),
      });
    }
    if (p[2] === 'logo' && method === 'GET') {
      const configuredLogo = settingsOf(tenant).branding?.logoId;
      if (!configuredLogo) fail(404, 'Logo not found.');
      const logoId = configuredLogo as string;
      const file = await one<{ id: string }>(
        db,
        'SELECT id FROM files WHERE tenantId=? AND id=? AND orderId IS NULL',
        tenant.id,
        logoId,
      );
      if (!file) fail(404, 'Logo not found.');
      return download(env, tenant.id, logoId, undefined, true);
    }
    if (p[2] === 'orders' && method === 'POST') {
      await rateLimit(req, db, `checkout:${tenant.id}`, 20);
      return json(
        await placeOrder(env, tenant, await body(req, checkoutInput)),
        201,
      );
    }
    if (p[2] === 'track') {
      await rateLimit(req, db, `track:${tenant.id}`, 200);
      if (!/^[a-f0-9]{64}$/.test(p[3] || ''))
        fail(404, 'Tracking link not found.');
      const order = await one<Order>(
        db,
        'SELECT * FROM orders WHERE tenantId=? AND trackingHash=?',
        tenant.id,
        hash(p[3]),
      );
      if (!order)
        fail(404, 'This tracking link is invalid or has been revoked.');
      const o = order!;
      if (p.length === 4 && method === 'GET')
        return json({
          tenant: { name: tenant.name, slug: tenant.slug },
          order: {
            reference: o.reference,
            status: o.status,
            payment: o.payment,
            total: o.total,
            deliveryStatus: o.deliveryStatus,
            createdAt: o.createdAt,
          },
          items: await rows(
            db,
            'SELECT name,quantity,price,variant FROM items WHERE tenantId=? AND orderId=?',
            tenant.id,
            o.id,
          ),
          events: await rows(
            db,
            'SELECT action,createdAt FROM events WHERE tenantId=? AND orderId=? AND public=1 ORDER BY createdAt',
            tenant.id,
            o.id,
          ),
          proofs: await rows(
            db,
            'SELECT p.id,p.version,p.fileId,p.note,p.status,p.feedback,p.createdAt,f.type AS contentType FROM proofs p JOIN files f ON f.id=p.fileId AND f.tenantId=p.tenantId WHERE p.tenantId=? AND p.orderId=? ORDER BY p.version DESC',
            tenant.id,
            o.id,
          ),
        });
      if (p[4] === 'files' && method === 'POST') {
        await rateLimit(req, db, `upload:${tenant.id}`, 20);
        if (['Cancelled', 'Returned', 'Delivered'].includes(o.status))
          fail(409, 'Uploads are closed for this order.');
        return upload(req, env, tenant.id, o.id, 'Customer');
      }
      if (p[4] === 'files' && p[5] && method === 'GET')
        return download(env, tenant.id, p[5], o.id);
      if (p[4] === 'proofs' && p[5] && method === 'POST') {
        const input = await body(
          req,
          z
            .object({
              decision: z.enum(['Approved', 'Changes requested']),
              feedback: z.string().max(2000),
            })
            .strict(),
        );
        const latest = await one<{ id: string; status: string }>(
          db,
          'SELECT id,status FROM proofs WHERE tenantId=? AND orderId=? ORDER BY version DESC LIMIT 1',
          tenant.id,
          o.id,
        );
        if (!latest || latest.id !== p[5] || latest.status !== 'Pending')
          fail(409, 'This proof is no longer awaiting your decision.');
        const result = await db.batch([
          stmt(
            db,
            'UPDATE proofs SET status=?,feedback=? WHERE tenantId=? AND orderId=? AND id=? AND status=?',
            input.decision,
            input.feedback,
            tenant.id,
            o.id,
            p[5],
            'Pending',
          ),
          event(
            db,
            tenant.id,
            'Customer',
            `Proof ${input.decision.toLowerCase()}`,
            o.id,
            '',
            true,
          ),
        ]);
        if (!result[0].meta.changes) fail(409, 'This proof already changed.');
        return json({ ok: true });
      }
    }
    return json({ error: 'Not found.' }, 404);
  }
  if (p[0] === 'images' && p[1] && method === 'GET') {
    const file = await one<{ tenantId: string }>(
      db,
      'SELECT f.tenantId FROM files f JOIN products p ON p.tenantId=f.tenantId AND p.image=? JOIN tenants t ON t.id=p.tenantId WHERE f.id=? AND p.active=1 AND t.active=1 AND t.subscription!=?',
      `/api/images/${p[1]}`,
      p[1],
      'suspended',
    );
    if (!file) fail(404, 'Image not found.');
    return download(env, file!.tenantId, p[1], undefined, true);
  }
  const user = await session(req, env);
  if (p[0] === 'me' && method === 'GET')
    return json({
      user,
      tenant: user.tenantId
        ? await one(db, 'SELECT * FROM tenants WHERE id=?', user.tenantId)
        : null,
    });
  if (p[0] === 'password' && method === 'POST') {
    const input = await body(
      req,
      z
        .object({
          current: z.string().max(256),
          password: z.string().min(12).max(128),
        })
        .strict(),
    );
    const signedIn = await auth(env).signIn(user.email, input.current);
    if (!signedIn || signedIn.id !== user.id)
      fail(400, 'Current password is incorrect.');
    await auth(env).updatePassword(user.id, input.password);
    await db.batch([stmt(db, 'DELETE FROM sessions WHERE userId=?', user.id)]);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, '', 0) });
  }
  if (p[0] === 'admin') {
    requireRole(user, ['super_admin']);
    if (p[1] === 'tenants' && method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 120);
      const status = (url.searchParams.get('subscription') || '').trim();
      const plan = (url.searchParams.get('plan') || '').trim().slice(0, 50);
      const active = url.searchParams.get('active') || 'all';
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 25)));
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
      const where: string[] = [];
      const args: unknown[] = [];
      if (q) {
        const needle = `%${q}%`;
        where.push(
          "(LOWER(t.name) LIKE ? OR LOWER(t.slug) LIKE ? OR LOWER(t.slug || '.inchouf.com') LIKE ? OR EXISTS (SELECT 1 FROM users u WHERE u.tenantId=t.id AND u.role='owner' AND LOWER(u.email) LIKE ?))",
        );
        args.push(needle, needle, needle, needle);
      }
      if (
        ['trial', 'active', 'past_due', 'suspended', 'cancelled'].includes(
          status,
        )
      ) {
        where.push('t.subscription=?');
        args.push(status);
      }
      if (plan) {
        where.push('LOWER(t.plan)=?');
        args.push(plan.toLowerCase());
      }
      if (active === 'enabled') where.push('t.active=1');
      if (active === 'disabled') where.push('t.active=0');
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = await one<{ count: number }>(
        db,
        `SELECT COUNT(*) AS count FROM tenants t ${whereSql}`,
        ...args,
      );
      const summary = await one<{
        activeCount: number;
        suspendedCount: number;
        monthlyValue: number;
      }>(
        db,
        `SELECT SUM(CASE WHEN t.active=1 AND t.subscription!='suspended' THEN 1 ELSE 0 END) AS activeCount, SUM(CASE WHEN t.active=0 OR t.subscription='suspended' THEN 1 ELSE 0 END) AS suspendedCount, SUM(CASE WHEN t.active=1 AND t.subscription='active' THEN t.price ELSE 0 END) AS monthlyValue FROM tenants t ${whereSql}`,
        ...args,
      );
      return json({
        tenants: await rows(
          db,
          `SELECT t.*, (SELECT email FROM users u WHERE u.tenantId=t.id AND u.role='owner' ORDER BY createdAt LIMIT 1) AS ownerEmail, (SELECT COUNT(*) FROM orders o WHERE o.tenantId=t.id) AS orderCount, (SELECT COUNT(*) FROM users u WHERE u.tenantId=t.id AND u.active=1) AS userCount FROM tenants t ${whereSql} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
          ...args,
          limit,
          offset,
        ),
        total: Number(total?.count || 0),
        summary: {
          activeCount: Number(summary?.activeCount || 0),
          suspendedCount: Number(summary?.suspendedCount || 0),
          monthlyValue: Number(summary?.monthlyValue || 0),
        },
        limit,
        offset,
        events: await rows(
          db,
          'SELECT * FROM platformEvents ORDER BY createdAt DESC LIMIT 50',
        ),
      });
    }
    if (p[1] === 'tenants' && p.length === 2 && method === 'POST') {
      const { input, logo } = await tenantCreateBody(req);
      const id = uid();
      if (await one(db, 'SELECT id FROM tenants WHERE slug=?', input.slug))
        fail(409, 'That email, SKU, slug or request already exists.');
      if (await one(db, 'SELECT id FROM users WHERE email=?', input.email))
        fail(409, 'That email, SKU, slug or request already exists.');
      const owner = await auth(env).createUser({
        email: input.email,
        password: input.password,
        name: input.ownerName,
        role: 'owner',
        tenantId: id,
      });
      const logoId = logo ? uid() : '';
      if (logo) {
        try {
          await env.FILES.put(`${id}/${logoId}`, logo.data, {
            httpMetadata: { contentType: logo.type },
          });
        } catch (e) {
          await auth(env)
            .deleteUser(owner.id)
            .catch(() => {});
          throw e;
        }
      }
      try {
        const settings = {
          ...defaultSettings,
          branding: logoId ? { logoId } : undefined,
        };
        await db.batch([
          stmt(
            db,
            'INSERT INTO tenants (id,name,slug,trialStart,trialEnd,settings,createdAt) VALUES (?,?,?,?,?,?,?)',
            id,
            input.name,
            input.slug,
            now(),
            new Date(Date.now() + 14 * 86400000).toISOString(),
            JSON.stringify(settings),
            now(),
          ),
          ...(logo
            ? [
                stmt(
                  db,
                  'INSERT INTO files (id,tenantId,orderId,name,type,size,createdAt) VALUES (?,?,?,?,?,?,?)',
                  logoId,
                  id,
                  null,
                  logo.name,
                  logo.type,
                  logo.size,
                  now(),
                ),
              ]
            : []),
          stmt(
            db,
            'INSERT INTO users (id,tenantId,email,name,role,createdAt) VALUES (?,?,?,?,?,?)',
            owner.id,
            id,
            input.email,
            input.ownerName,
            'owner',
            now(),
          ),
          platformEvent(db, user.name, 'Business created', input.slug),
        ]);
      } catch (e) {
        if (logoId)
          await env.FILES.delete(`${id}/${logoId}`).catch(() => {});
        await auth(env)
          .deleteUser(owner.id)
          .catch(() => {});
        throw e;
      }
      return json({ id }, 201);
    }
    if (p[1] === 'tenants' && p[2] && method === 'PATCH') {
      const input = await body(
        req,
        z
          .object({
            active: z.boolean(),
            subscription: z.enum([
              'trial',
              'active',
              'past_due',
              'suspended',
              'cancelled',
            ]),
            plan: z.string().min(1).max(50),
            price: z.number().int().min(0).max(10000000),
            trialStart: z.iso.datetime().nullable(),
            trialEnd: z.iso.datetime().nullable(),
            renewalDate: z.iso.datetime().nullable(),
          })
          .strict(),
      );
      const t = await one<Tenant>(db, 'SELECT * FROM tenants WHERE id=?', p[2]);
      if (!t) fail(404, 'Business not found.');
      await db.batch([
        stmt(
          db,
          'UPDATE tenants SET active=?,subscription=?,plan=?,price=?,trialStart=?,trialEnd=?,renewalDate=?,suspendedDate=? WHERE id=?',
          Number(input.active),
          input.subscription,
          input.plan,
          input.price,
          input.trialStart,
          input.trialEnd,
          input.renewalDate,
          !input.active || input.subscription === 'suspended' ? now() : null,
          p[2],
        ),
        platformEvent(
          db,
          user.name,
          'Subscription updated',
          `${t!.slug}: ${input.subscription}`,
        ),
      ]);
      return json({ ok: true });
    }
    if (p[1] === 'tenants' && p[2] && p[3] === 'reset' && method === 'POST') {
      const input = await body(
        req,
        z.object({ password: z.string().min(12).max(128) }).strict(),
      );
      const owner = await one<User>(
        db,
        'SELECT id FROM users WHERE tenantId=? AND role=?',
        p[2],
        'owner',
      );
      if (!owner) fail(404, 'Owner not found.');
      await auth(env).updatePassword(owner!.id, input.password);
      await db.batch([
        stmt(db, 'DELETE FROM sessions WHERE userId=?', owner!.id),
        platformEvent(db, user.name, 'Owner access reset', p[2]),
      ]);
      return json({ ok: true });
    }
    return json({ error: 'Not found.' }, 404);
  }
  if (!user.tenantId) fail(403, 'A business account is required.');
  const t = user.tenantId!;
  if (p[0] === 'orders') {
    allow(user, 'orders');
    if (method === 'GET' && p.length === 1) {
      let where = 'tenantId=?';
      const args: unknown[] = [t];
      if (user.role === 'picker') {
        where += ' AND (employeeId IS NULL OR employeeId=?)';
        args.push(user.id);
      }
      if (user.role === 'delivery_manager') {
        where += ' AND driverId=?';
        args.push(user.id);
      }
      return json(
        await rows(
          db,
          `SELECT * FROM orders WHERE ${where} ORDER BY createdAt DESC LIMIT 500`,
          ...args,
        ),
      );
    }
    if (method === 'GET' && p[1] === 'export') {
      requireRole(user, ['owner', 'order_manager']);
      const exported = await rows<Order>(
        db,
        'SELECT reference,customer,phone,status,payment,total,address,createdAt FROM orders WHERE tenantId=? ORDER BY createdAt DESC LIMIT 5000',
        t,
      );
      return new Response(
        exportCSV([
          [
            'Reference',
            'Customer',
            'Phone',
            'Status',
            'Payment',
            'Total USD',
            'Address',
            'Created at',
          ],
          ...exported.map((o) => [
            o.reference,
            o.customer,
            o.phone,
            o.status,
            o.payment,
            (o.total / 100).toFixed(2),
            o.address,
            o.createdAt,
          ]),
        ]),
        {
          headers: {
            'Content-Type': 'text/csv;charset=utf-8',
            'Content-Disposition': 'attachment; filename="orders.csv"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    }
    if (method === 'POST' && p.length === 1) {
      requireRole(user, ['owner', 'order_manager']);
      const tenant = await one<Tenant>(
        db,
        'SELECT * FROM tenants WHERE id=?',
        t,
      );
      return json(
        await placeOrder(
          env,
          tenant!,
          await body(req, checkoutInput),
          user.name,
        ),
        201,
      );
    }
    if (p[1] && p.length === 2 && method === 'GET')
      return json(await orderDetail(env, t, p[1], user));
    if (p[1] && p.length === 2 && method === 'PATCH')
      return json(
        await updateOrder(env, user, p[1], await body(req, updateOrderInput)),
      );
    if (p[1] && p[2] === 'tracking' && method === 'POST') {
      requireRole(user, ['owner', 'order_manager']);
      await orderDetail(env, t, p[1], user);
      const input = await body(req, z.object({ revoke: z.boolean() }).strict());
      const raw = input.revoke ? null : token();
      await db.batch([
        stmt(
          db,
          'UPDATE orders SET trackingHash=? WHERE tenantId=? AND id=?',
          raw ? hash(raw) : null,
          t,
          p[1],
        ),
        event(
          db,
          t,
          user.name,
          raw ? 'Tracking link rotated' : 'Tracking link revoked',
          p[1],
        ),
      ]);
      const tenant = await one<Tenant>(
        db,
        'SELECT slug FROM tenants WHERE id=?',
        t,
      );
      return json({
        trackingUrl: raw ? `/store/${tenant!.slug}/order/${raw}` : null,
      });
    }
    if (p[1] && p[2] === 'files' && method === 'GET') {
      await orderDetail(env, t, p[1], user);
      return json(
        await rows(
          db,
          'SELECT id,name,type,size FROM files WHERE tenantId=? AND orderId=?',
          t,
          p[1],
        ),
      );
    }
    if (p[1] && p[2] === 'files' && method === 'POST') {
      requireRole(user, ['owner', 'order_manager']);
      await orderDetail(env, t, p[1], user);
      return upload(req, env, t, p[1], user.name);
    }
    if (p[1] && p[2] === 'proofs' && method === 'POST') {
      requireRole(user, ['owner', 'order_manager']);
      const detail = await orderDetail(env, t, p[1], user);
      if (
        !['New', 'Confirmed', 'Picking', 'Needs Attention'].includes(
          detail.order!.status,
        )
      )
        fail(409, 'This order is already past proof preparation.');
      const input = await body(
        req,
        z.object({ fileId: z.uuid(), note: z.string().max(2000) }).strict(),
      );
      await db.batch([
        stmt(
          db,
          'INSERT INTO proofs (id,tenantId,orderId,version,fileId,note,createdAt) SELECT ?,?,?,COALESCE(MAX(version),0)+1,?,?,? FROM proofs WHERE tenantId=? AND orderId=?',
          uid(),
          t,
          p[1],
          input.fileId,
          input.note,
          now(),
          t,
          p[1],
        ),
        event(
          db,
          t,
          user.name,
          'Proof ready',
          p[1],
          'A new proof is ready to review.',
          true,
        ),
      ]);
      return json({ ok: true }, 201);
    }
  }
  if (p[0] === 'products') {
    allow(user, 'products');
    if (method === 'GET')
      return json(
        await rows(
          db,
          'SELECT * FROM products WHERE tenantId=? ORDER BY name',
          t,
        ),
      );
    if (['POST', 'PATCH'].includes(method)) {
      const input = await body(req, productInput);
      if (
        input.image.startsWith('/api/images/') &&
        !(await one(
          db,
          'SELECT id FROM files WHERE id=? AND tenantId=? AND orderId IS NULL',
          input.image.split('/').pop(),
          t,
        ))
      )
        fail(400, 'Choose an image uploaded by your business.');
      if (
        method === 'PATCH' &&
        !(await one(
          db,
          'SELECT id FROM products WHERE tenantId=? AND id=?',
          t,
          p[1],
        ))
      )
        fail(404, 'Product not found.');
      const id = method === 'POST' ? uid() : p[1];
      const fields = [
        input.name,
        input.description,
        input.category,
        input.sku,
        input.price,
        input.stock,
        input.lowStock,
        Number(input.active),
        input.image,
        JSON.stringify(input.variants),
        JSON.stringify(input.customFields),
      ];
      await db.batch([
        method === 'POST'
          ? stmt(
              db,
              'INSERT INTO products (name,description,category,sku,price,stock,lowStock,active,image,variants,customFields,id,tenantId,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
              ...fields,
              id,
              t,
              now(),
            )
          : stmt(
              db,
              'UPDATE products SET name=?,description=?,category=?,sku=?,price=?,stock=?,lowStock=?,active=?,image=?,variants=?,customFields=? WHERE id=? AND tenantId=?',
              ...fields,
              id,
              t,
            ),
        event(
          db,
          t,
          user.name,
          'Product saved',
          null,
          `${input.sku}: stock ${input.stock}`,
        ),
      ]);
      return json({ id });
    }
  }
  if (p[0] === 'catalog' && method === 'GET') {
    allow(user, 'orders');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 120);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const productWhere = q
      ? 'tenantId=? AND active=1 AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ?)'
      : 'tenantId=? AND active=1';
    const productArgs = q ? [t, `%${q}%`, `%${q}%`] : [t];
    return json({
      products: await rows(
        db,
        `SELECT * FROM products WHERE ${productWhere} ORDER BY name LIMIT ?`,
        ...productArgs,
        limit,
      ),
      zones: await rows(
        db,
        'SELECT * FROM zones WHERE tenantId=? AND active=1',
        t,
      ),
    });
  }
  if (p[0] === 'zones') {
    allow(user, 'delivery');
    if (method === 'GET')
      return json(await rows(db, 'SELECT * FROM zones WHERE tenantId=?', t));
    requireRole(user, ['owner']);
    if (['POST', 'PATCH'].includes(method)) {
      const i = await body(req, zoneInput);
      if (
        method === 'PATCH' &&
        !(await one(
          db,
          'SELECT id FROM zones WHERE tenantId=? AND id=?',
          t,
          p[1],
        ))
      )
        fail(404, 'Zone not found.');
      const fields = [
        i.name,
        i.fee,
        i.freeAbove,
        i.minimum,
        Number(i.active),
        i.notes,
      ];
      const id = method === 'POST' ? uid() : p[1];
      await db.batch([
        method === 'POST'
          ? stmt(
              db,
              'INSERT INTO zones (name,fee,freeAbove,minimum,active,notes,id,tenantId) VALUES (?,?,?,?,?,?,?,?)',
              ...fields,
              id,
              t,
            )
          : stmt(
              db,
              'UPDATE zones SET name=?,fee=?,freeAbove=?,minimum=?,active=?,notes=? WHERE id=? AND tenantId=?',
              ...fields,
              id,
              t,
            ),
        event(db, t, user.name, 'Delivery zone saved', null, i.name),
      ]);
      return json({ id });
    }
  }
  if (p[0] === 'team') {
    if (method === 'GET') {
      allow(user, 'orders');
      return json(
        await rows(
          db,
          'SELECT id,name,role,active FROM users WHERE tenantId=? AND active=1',
          t,
        ),
      );
    }
    allow(user, 'team');
    if (method === 'POST') {
      const i = await body(req, staffInput);
      if (await one(db, 'SELECT id FROM users WHERE email=?', i.email))
        fail(409, 'That email, SKU, slug or request already exists.');
      const created = await auth(env).createUser({
        email: i.email,
        password: i.password,
        name: i.name,
        role: i.role,
        tenantId: t,
      });
      try {
        await db.batch([
          stmt(
            db,
            'INSERT INTO users (id,tenantId,email,name,role,createdAt) VALUES (?,?,?,?,?,?)',
            created.id,
            t,
            i.email,
            i.name,
            i.role,
            now(),
          ),
          event(db, t, user.name, 'Employee created', null, i.name),
        ]);
      } catch (e) {
        await auth(env)
          .deleteUser(created.id)
          .catch(() => {});
        throw e;
      }
      return json({ id: created.id }, 201);
    }
    if (method === 'PATCH' && p[1]) {
      const i = await body(
        req,
        z
          .object({
            active: z.boolean(),
            role: z.enum([
              'order_manager',
              'picker',
              'delivery_manager',
              'assistant',
            ]),
          })
          .strict(),
      );
      const member = await one<User>(
        db,
        'SELECT * FROM users WHERE id=? AND tenantId=? AND role!=?',
        p[1],
        t,
        'owner',
      );
      if (!member) fail(404, 'Employee not found.');
      if (i.active && !member!.active) {
        const count = await one<{ n: number }>(
          db,
          'SELECT COUNT(*) n FROM users WHERE tenantId=? AND role!=? AND active=1',
          t,
          'owner',
        );
        if (count!.n >= 2)
          fail(409, 'Starter supports up to two active employees.');
      }
      await db.batch([
        stmt(
          db,
          'UPDATE users SET role=?,active=? WHERE id=? AND tenantId=?',
          i.role,
          Number(i.active),
          p[1],
          t,
        ),
        stmt(db, 'DELETE FROM sessions WHERE userId=?', p[1]),
        event(db, t, user.name, 'Employee access updated', null, member!.name),
      ]);
      return json({ ok: true });
    }
  }
  if (p[0] === 'employees' && method === 'GET') {
    allow(user, 'team');
    return json(
      await rows(
        db,
        'SELECT id,name,email,role,active FROM users WHERE tenantId=?',
        t,
      ),
    );
  }
  if (p[0] === 'settings') {
    allow(user, 'settings');
    if (method === 'PATCH') {
      const i = await body(req, settingsInput);
      const tenant = await one<Tenant>(db, 'SELECT * FROM tenants WHERE id=?', t);
      const branding = tenant ? settingsOf(tenant).branding : undefined;
      await db.batch([
        stmt(
          db,
          'UPDATE tenants SET settings=? WHERE id=?',
          JSON.stringify({ ...i, branding }),
          t,
        ),
        event(db, t, user.name, 'Storefront settings updated'),
      ]);
      return json({ ok: true });
    }
  }
  if (p[0] === 'customers' && method === 'GET') {
    allow(user, 'customers');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 120);
    if (p[1]) {
      const phone = decodeURIComponent(p[1]);
      const summary = await one<{
        phone: string;
        name: string;
        email: string;
        orders: number;
        deliveredOrders: number;
        revenue: number;
        outstanding: number;
        lastOrder: string;
      }>(
        db,
        "SELECT phone,MAX(customer) name,MAX(email) email,COUNT(*) orders,SUM(CASE WHEN status='Delivered' THEN 1 ELSE 0 END) deliveredOrders,SUM(CASE WHEN status='Delivered' THEN total ELSE 0 END) revenue,SUM(CASE WHEN payment!='Paid' AND status NOT IN ('Cancelled','Returned','Failed Delivery') THEN total-cashCollected ELSE 0 END) outstanding,MAX(createdAt) lastOrder FROM orders WHERE tenantId=? AND phone=? GROUP BY phone",
        t,
        phone,
      );
      if (!summary) fail(404, 'Customer not found.');
      return json({
        customer: summary,
        orders: await rows(
          db,
          'SELECT id,reference,status,payment,total,cashCollected,createdAt FROM orders WHERE tenantId=? AND phone=? ORDER BY createdAt DESC LIMIT 100',
          t,
          phone,
        ),
      });
    }
    const where = q
      ? "tenantId=? AND (LOWER(customer) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(email) LIKE ?)"
      : 'tenantId=?';
    const args = q ? [t, `%${q}%`, `%${q}%`, `%${q}%`] : [t];
    return json(
      await rows(
        db,
        `SELECT phone,MAX(customer) name,MAX(email) email,COUNT(*) orders,SUM(CASE WHEN status='Delivered' THEN total ELSE 0 END) revenue,SUM(CASE WHEN payment!='Paid' AND status NOT IN ('Cancelled','Returned','Failed Delivery') THEN total-cashCollected ELSE 0 END) outstanding,MAX(createdAt) lastOrder FROM orders WHERE ${where} GROUP BY phone ORDER BY lastOrder DESC LIMIT 100`,
        ...args,
      ),
    );
  }
  if (p[0] === 'settlements') {
    requireRole(user, ['owner']);
    if (method === 'GET') {
      return json({
        settlements: await rows(
          db,
          'SELECT * FROM settlements WHERE tenantId=? ORDER BY createdAt DESC LIMIT 100',
          t,
        ),
        orders: await rows(
          db,
          'SELECT so.settlementId,so.amount,o.reference,o.customer,o.status,o.payment FROM settlementorders so JOIN orders o ON o.tenantId=so.tenantId AND o.id=so.orderId WHERE so.tenantId=? ORDER BY o.createdAt DESC LIMIT 500',
          t,
        ),
      });
    }
    if (method === 'POST') {
      const input = await body(req, settlementInput);
      if (input.method === 'internal_driver' && !input.driverId)
        fail(400, 'Choose a driver to reconcile.');
      if (input.method === 'external_courier' && !input.provider?.trim())
        fail(400, 'Enter the external courier name.');
      if (input.driverId) {
        const driver = await one<User>(
          db,
          'SELECT id,role FROM users WHERE tenantId=? AND id=? AND active=1',
          t,
          input.driverId,
        );
        if (!driver || !['owner', 'delivery_manager'].includes(driver.role))
          fail(400, 'Choose an active delivery employee.');
      }
      const filters = [
        'o.tenantId=?',
        "o.status='Delivered'",
        "o.paymentMethod='Cash on delivery'",
        "o.payment!='Refunded'",
        'so.id IS NULL',
        'o.createdAt >= COALESCE(?, o.createdAt)',
        'o.createdAt <= COALESCE(?, o.createdAt)',
      ];
      const args: unknown[] = [t, input.periodStart ?? null, input.periodEnd ?? null];
      if (input.method === 'internal_driver') {
        filters.push('o.deliveryMethod=?', 'o.driverId=?');
        args.push(input.method, input.driverId);
      } else {
        filters.push('o.deliveryMethod=?', 'LOWER(o.deliveryProvider)=LOWER(?)');
        args.push(input.method, input.provider || '');
      }
      const eligible = await rows<{ id: string; total: number }>(
        db,
        `SELECT o.id,o.total FROM orders o LEFT JOIN settlementorders so ON so.tenantId=o.tenantId AND so.orderId=o.id WHERE ${filters.join(' AND ')} ORDER BY o.createdAt`,
        ...args,
      );
      if (!eligible.length) fail(409, 'No unsettled delivered COD orders match.');
      const expected = eligible.reduce((sum, order) => sum + order.total, 0);
      const variance = input.actual - expected;
      const settlementId = uid();
      const status = variance === 0 ? 'balanced' : variance < 0 ? 'missing' : 'extra';
      await db.batch([
        stmt(
          db,
          'INSERT INTO settlements (id,tenantId,method,driverId,provider,periodStart,periodEnd,expected,actual,variance,status,createdBy,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          settlementId,
          t,
          input.method,
          input.driverId ?? null,
          input.provider || '',
          input.periodStart ?? null,
          input.periodEnd ?? null,
          expected,
          input.actual,
          variance,
          status,
          user.id,
          now(),
        ),
        ...eligible.map((order) =>
          stmt(
            db,
            'INSERT INTO settlementorders (id,tenantId,settlementId,orderId,amount) VALUES (?,?,?,?,?)',
            uid(),
            t,
            settlementId,
            order.id,
            order.total,
          ),
        ),
        ...(input.actual >= expected
          ? eligible.map((order) =>
              stmt(
                db,
                'UPDATE orders SET payment=?,cashCollected=?,updatedAt=? WHERE tenantId=? AND id=?',
                'Paid',
                order.total,
                now(),
                t,
                order.id,
              ),
            )
          : []),
        event(
          db,
          t,
          user.name,
          'Cash settlement created',
          null,
          `Expected ${(expected / 100).toFixed(2)} / Returned ${(input.actual / 100).toFixed(2)} / ${status}`,
        ),
      ]);
      return json({ id: settlementId, expected, actual: input.actual, variance, status }, 201);
    }
  }
  if (p[0] === 'waiting-proofs' && method === 'GET') {
    allow(user, 'orders');
    return json(
      await rows(
        db,
        "SELECT DISTINCT p.orderId FROM proofs p JOIN orders o ON o.id=p.orderId AND o.tenantId=p.tenantId WHERE p.tenantId=? AND p.status='Pending' AND p.version=(SELECT MAX(version) FROM proofs p2 WHERE p2.tenantId=p.tenantId AND p2.orderId=p.orderId) AND (? != 'picker' OR o.employeeId IS NULL OR o.employeeId=?) AND (? != 'delivery_manager' OR o.driverId=?)",
        t,
        user.role,
        user.id,
        user.role,
        user.id,
      ),
    );
  }
  if (p[0] === 'audit' && method === 'GET') {
    requireRole(user, ['owner']);
    return json(
      await rows(
        db,
        'SELECT * FROM events WHERE tenantId=? ORDER BY createdAt DESC LIMIT 200',
        t,
      ),
    );
  }
  if (p[0] === 'files' && p[1] && method === 'GET') {
    allow(user, 'orders');
    const f = await one<{ orderId: string | null }>(
      db,
      'SELECT orderId FROM files WHERE tenantId=? AND id=?',
      t,
      p[1],
    );
    if (!f) fail(404, 'File not found.');
    if (f!.orderId) await orderDetail(env, t, f!.orderId, user);
    else allow(user, 'products');
    return download(env, t, p[1]);
  }
  if (p[0] === 'files' && method === 'POST') {
    allow(user, 'products');
    return upload(req, env, t, null, user.name);
  }
  return json({ error: 'Not found.' }, 404);
}
async function upload(
  req: Request,
  env: Runtime,
  tenantId: string,
  orderId: string | null,
  actor: string,
) {
  const length = Number(req.headers.get('content-length'));
  if (length > 5 * 1024 * 1024) fail(413, 'File must be smaller than 5 MB.');
  const reader = req.body?.getReader();
  if (!reader) fail(400, 'Choose a file.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) {
      await reader!.cancel();
      fail(413, 'File must be smaller than 5 MB.');
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  const upload = validateUpload(
    data,
    req.headers.get('x-file-name') || 'upload',
    orderId,
  );
  const id = uid();
  const db = database(env);
  await env.FILES.put(`${tenantId}/${id}`, upload.data, {
    httpMetadata: { contentType: upload.type },
  });
  try {
    await db.batch([
      stmt(
        db,
        'INSERT INTO files (id,tenantId,orderId,name,type,size,createdAt) VALUES (?,?,?,?,?,?,?)',
        id,
        tenantId,
        orderId,
        upload.name,
        upload.type,
        upload.size,
        now(),
      ),
      event(db, tenantId, actor, 'File uploaded', orderId, upload.name),
    ]);
  } catch (e) {
    await env.FILES.delete(`${tenantId}/${id}`);
    throw e;
  }
  return json({ id, name: upload.name, type: upload.type, size: upload.size }, 201);
}
async function download(
  env: Runtime,
  tenantId: string,
  id: string,
  orderId?: string,
  publicImage = false,
) {
  const f = await one<{ name: string; type: string; orderId: string | null }>(
    database(env),
    'SELECT name,type,orderId FROM files WHERE tenantId=? AND id=?',
    tenantId,
    id,
  );
  if (!f || (orderId && f.orderId !== orderId)) fail(404, 'File not found.');
  const object = await env.FILES.get(`${tenantId}/${id}`);
  if (!object) fail(404, 'File not found.');
  return new Response(object!.body, {
    headers: {
      'Content-Type': f!.type,
      'Content-Disposition': `${publicImage || f!.type.startsWith('image/') ? 'inline' : 'attachment'}; filename="${f!.name.replace(/["\\]/g, '_')}"`,
      'Cache-Control': publicImage ? 'public,max-age=300' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    },
  });
}
