import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { seedDemo } from '../lib/server/seed';
import {
  hash,
  token,
  hostTenant,
  validHost,
  temporaryWorkerHost,
} from '../lib/server/security';
import { parseCSV, exportCSV } from '../lib/csv';

const passwords = {
  admin: 'test-admin-long-password',
  owner: 'test-owner-long-password',
  picker: 'test-picker-long-password',
  driver: 'test-driver-long-password',
};

async function setup() {
  const h = await harness();
  await seedDemo(h.env, passwords);
  const tenant = (await h.get<{ id: string }>('SELECT id FROM tenants'))!;
  const owner = (await h.get<{ id: string }>(
    "SELECT id FROM users WHERE role='owner'",
  ))!;
  const raw = token();
  await h.run(
    'INSERT INTO sessions (id,userId,expires) VALUES (?,?,?)',
    hash(raw),
    owner.id,
    Date.now() + 3600000,
  );
  return { ...h, tenant: tenant.id, cookie: `op_session=${raw}` };
}

async function checkout(h: Awaited<ReturnType<typeof setup>>, quantity = 1) {
  const zone = (await h.get<{ id: string }>(
    'SELECT id FROM zones WHERE tenantId=? ORDER BY fee LIMIT 1',
    h.tenant,
  ))!;
  const product = (await h.get<{ id: string }>(
    "SELECT id FROM products WHERE tenantId=? AND category='Audio' LIMIT 1",
    h.tenant,
  ))!;
  return {
    customer: 'Internal Test',
    phone: '0000000000',
    email: '',
    address: 'Internal testing address',
    zoneId: zone.id,
    notes: 'Test only',
    paymentMethod: 'Cash on delivery',
    idempotency: crypto.randomUUID(),
    items: [
      { productId: product.id, quantity, variant: 'Charcoal', custom: {} },
    ],
  };
}

void test('production bootstrap creates only the first platform admin', async () => {
  const h = await harness();
  const tokenHeader = { 'X-Bootstrap-Token': 'test-only-bootstrap-token' };
  const input = {
    email: 'ADMIN@INCHOUF.COM',
    password: 'first-admin-password',
    name: 'InChouf Admin',
  };

  assert.equal((await h.request('bootstrap', 'POST', input)).status, 404);
  assert.equal(
    (
      await h.request(
        'bootstrap',
        'POST',
        input,
        '',
        'http://test.invalid',
        'http://evil.test',
        tokenHeader,
      )
    ).status,
    403,
  );

  const created = await h.request(
    'bootstrap',
    'POST',
    input,
    '',
    'http://test.invalid',
    'http://test.invalid',
    tokenHeader,
  );
  const createdText = await created.text();
  assert.equal(created.status, 201, createdText);
  const response = JSON.parse(createdText) as {
    ok: boolean;
    user: { email: string; role: string };
    password?: string;
  };
  assert.deepEqual(response, {
    ok: true,
    user: { email: 'admin@inchouf.com', role: 'super_admin' },
  });
  assert.equal(response.password, undefined);

  assert.equal(
    (await h.get<{ count: number }>('SELECT COUNT(*) count FROM users'))!.count,
    1,
  );
  assert.equal(
    (await h.get<{ count: number }>('SELECT COUNT(*) count FROM tenants'))!
      .count,
    0,
  );
  assert.deepEqual(
    await h.get(
      'SELECT email,name,role,tenantId FROM users WHERE email=?',
      'admin@inchouf.com',
    ),
    {
      email: 'admin@inchouf.com',
      name: 'InChouf Admin',
      role: 'super_admin',
      tenantId: null,
    },
  );
  assert.equal(
    (
      await h.request('login', 'POST', {
        email: 'admin@inchouf.com',
        password: input.password,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request(
        'bootstrap',
        'POST',
        {
          email: 'second@inchouf.com',
          password: 'second-admin-password',
        },
        '',
        'http://test.invalid',
        'http://test.invalid',
        tokenHeader,
      )
    ).status,
    409,
  );
});

void test('tenant isolation covers catalog, orders, storefronts and settings', async () => {
  const h = await setup();
  const date = new Date().toISOString();
  await h.run(
    'INSERT INTO tenants (id,name,slug,createdAt) VALUES (?,?,?,?)',
    'other-tenant',
    'Other fixture',
    'other-fixture',
    date,
  );
  await h.run(
    'INSERT INTO products (id,tenantId,name,sku,price,stock,createdAt) VALUES (?,?,?,?,?,?,?)',
    'other-product',
    'other-tenant',
    'Private product',
    'OTHER',
    5000,
    10,
    date,
  );
  await h.run(
    'INSERT INTO zones (id,tenantId,name,fee) VALUES (?,?,?,?)',
    'other-zone',
    'other-tenant',
    'Private zone',
    100,
  );
  await h.run(
    'INSERT INTO orders (id,tenantId,reference,customer,phone,address,zoneId,subtotal,deliveryFee,total,idempotency,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    'other-order',
    'other-tenant',
    'PRIVATE',
    'Private customer',
    'PRIVATE',
    'Private address',
    'other-zone',
    5000,
    100,
    5100,
    'private-key',
    date,
    date,
  );

  const list = await h.request('products', 'GET', undefined, h.cookie);
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(await list.json()).includes('Private product'));
  assert.equal(
    (await h.request('orders/other-order', 'GET', undefined, h.cookie)).status,
    404,
  );
  assert.equal(
    (
      await h.request(
        'products/other-product',
        'PATCH',
        {
          name: 'Hacked',
          description: '',
          category: 'General',
          sku: 'OTHER',
          price: 1,
          stock: 1,
          lowStock: 5,
          active: true,
          image: '',
          variants: [],
          customFields: [],
        },
        h.cookie,
      )
    ).status,
    404,
  );
  const input = await checkout(h);
  input.items[0].productId = 'other-product';
  input.items[0].variant = '';
  assert.equal(
    (await h.request('store/internal-demo/orders', 'POST', input)).status,
    400,
  );
  assert.equal(
    (
      await h.request(
        'settings',
        'PATCH',
        { tenantId: 'other-tenant' },
        h.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await h.request(
        'me',
        'GET',
        undefined,
        h.cookie,
        'https://other-fixture.inchouf.com',
      )
    ).status,
    403,
  );
  assert.equal(
    (await h.get<{ stock: number }>(
      'SELECT stock FROM products WHERE id=?',
      'other-product',
    ))!.stock,
    10,
  );
});

void test('PostgreSQL composite foreign keys reject cross-tenant relationships', async () => {
  const h = await setup();
  await h.run(
    'INSERT INTO tenants (id,name,slug,createdAt) VALUES (?,?,?,?)',
    'other',
    'Other fixture',
    'other-fixture',
    new Date().toISOString(),
  );
  await h.run(
    'INSERT INTO products (id,tenantId,name,sku,price,stock,createdAt) VALUES (?,?,?,?,?,?,?)',
    'alien-product',
    'other',
    'Other',
    'ALIEN',
    100,
    10,
    new Date().toISOString(),
  );
  await assert.rejects(
    h.run(
      'INSERT INTO items (id,tenantId,orderId,productId,name,quantity,price) VALUES (?,?,?,?,?,?,?)',
      crypto.randomUUID(),
      h.tenant,
      crypto.randomUUID(),
      'alien-product',
      'Alien',
      1,
      100,
    ),
    /foreign key|INSUFFICIENT_STOCK/i,
  );
});

void test('checkout reserves stock atomically and idempotency prevents duplicates', async () => {
  const h = await setup();
  const input = await checkout(h);
  assert.equal(
    (await h.request('store/internal-demo/orders', 'POST', input)).status,
    201,
  );
  assert.equal(
    (await h.request('store/internal-demo/orders', 'POST', input)).status,
    409,
  );
  assert.equal(
    (await h.get<{ stock: number }>(
      "SELECT stock FROM products WHERE tenantId=? AND category='Audio' LIMIT 1",
      h.tenant,
    ))!.stock,
    23,
  );
  assert.equal(
    (
      await h.request(
        'store/internal-demo/orders',
        'POST',
        await checkout(h, 100),
      )
    ).status,
    409,
  );
  assert.equal(
    (await h.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM orders WHERE tenantId=?',
      h.tenant,
    ))!.count,
    1,
  );
});

void test('cancellation restores inventory once and preserves order state transitions', async () => {
  const h = await setup();
  const created = (await (
    await h.request('store/internal-demo/orders', 'POST', await checkout(h))
  ).json()) as { id: string };
  assert.equal(
    (await h.get<{ stock: number }>(
      "SELECT stock FROM products WHERE tenantId=? AND category='Audio' LIMIT 1",
      h.tenant,
    ))!.stock,
    23,
  );
  const cancelled = await h.request(
    `orders/${created.id}`,
    'PATCH',
    { version: 0, status: 'Cancelled', reason: 'Test cancellation' },
    h.cookie,
  );
  assert.equal(cancelled.status, 200, await cancelled.text());
  assert.equal(
    (
      await h.request(
        `orders/${created.id}`,
        'PATCH',
        { version: 1, status: 'Cancelled', reason: 'Repeat' },
        h.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await h.get<{ stock: number }>(
      "SELECT stock FROM products WHERE tenantId=? AND category='Audio' LIMIT 1",
      h.tenant,
    ))!.stock,
    24,
  );
});

void test('Supabase Auth-backed login creates app sessions and enforces expiry and suspension', async () => {
  const h = await setup();
  const login = await h.request('login', 'POST', {
    email: 'owner@demo.inchouf.test',
    password: passwords.owner,
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie')!;
  assert.match(setCookie, /op_session=/);
  const raw = setCookie.match(/op_session=([^;]+)/)![1];
  assert.equal(
    (await h.request('me', 'GET', undefined, `op_session=${raw}`)).status,
    200,
  );
  await h.run('UPDATE sessions SET expires=0 WHERE id=?', hash(raw));
  assert.equal(
    (await h.request('me', 'GET', undefined, `op_session=${raw}`)).status,
    401,
  );
  await h.run('UPDATE tenants SET active=0 WHERE id=?', h.tenant);
  assert.equal(
    (await h.request('orders', 'GET', undefined, h.cookie)).status,
    403,
  );
});

void test('proof files are tenant-scoped and approved proofs cannot be changed', async () => {
  const h = await setup();
  const created = (await (
    await h.request('store/internal-demo/orders', 'POST', await checkout(h))
  ).json()) as { id: string; trackingUrl: string };
  const fileId = crypto.randomUUID();
  await h.run(
    'INSERT INTO files (id,tenantId,orderId,name,type,size,createdAt) VALUES (?,?,?,?,?,?,?)',
    fileId,
    h.tenant,
    created.id,
    'proof.png',
    'image/png',
    10,
    new Date().toISOString(),
  );
  assert.equal(
    (
      await h.request(
        `orders/${created.id}/proofs`,
        'POST',
        { fileId, note: 'Review' },
        h.cookie,
      )
    ).status,
    201,
  );
  await h.request(
    `orders/${created.id}`,
    'PATCH',
    { version: 0, status: 'Confirmed' },
    h.cookie,
  );
  await h.request(
    `orders/${created.id}`,
    'PATCH',
    { version: 1, status: 'Picking' },
    h.cookie,
  );
  assert.equal(
    (
      await h.request(
        `orders/${created.id}`,
        'PATCH',
        { version: 2, status: 'Packed' },
        h.cookie,
      )
    ).status,
    409,
  );
  const proof = (await h.get<{ id: string }>(
    'SELECT id FROM proofs WHERE orderId=?',
    created.id,
  ))!;
  const tracking = created.trackingUrl.split('/').pop()!;
  const approval = await h.request(
    `store/internal-demo/track/${tracking}/proofs/${proof.id}`,
    'POST',
    { decision: 'Approved', feedback: '' },
  );
  assert.equal(approval.status, 200, await approval.text());
  assert.equal(
    (
      await h.request(
        `orders/${created.id}`,
        'PATCH',
        { version: 2, status: 'Packed' },
        h.cookie,
      )
    ).status,
    200,
  );
  await assert.rejects(
    h.run("UPDATE proofs SET note='changed' WHERE id=?", proof.id),
    /PROOF_LOCKED/,
  );
  assert.equal(
    (
      await h.request(
        `orders/${created.id}/proofs`,
        'POST',
        { fileId, note: 'Replacement' },
        h.cookie,
      )
    ).status,
    409,
  );
});

void test('security helpers and CSV export retain their non-database guarantees', () => {
  assert.equal(hostTenant('internal-demo.inchouf.com'), 'internal-demo');
  assert.equal(hostTenant('app.inchouf.com'), null);
  assert.equal(validHost(temporaryWorkerHost, 'inchouf.com'), true);
  assert.equal(validHost('untrusted.workers.dev', 'inchouf.com'), false);
  assert.equal(validHost('business.inchouf.com', 'inchouf.com'), true);
  assert.deepEqual(parseCSV('a,b\n"hello, world","a""b"'), [
    ['a', 'b'],
    ['hello, world', 'a"b'],
  ]);
  assert.match(exportCSV([['=HYPERLINK("bad")']]), /"'=HYPERLINK/);
});

void test('the exact workers.dev host reaches the Worker while arbitrary hosts do not', async () => {
  const h = await harness();
  assert.equal(
    (
      await h.request(
        'health',
        'GET',
        undefined,
        '',
        `https://${temporaryWorkerHost}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request(
        'health',
        'GET',
        undefined,
        '',
        'https://untrusted.workers.dev',
      )
    ).status,
    400,
  );
});
