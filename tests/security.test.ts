import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness';
import { seedDemo } from '../lib/server/seed';
import {
  hash,
  token,
  passwordMatches,
  passwordHash,
  hostTenant,
} from '../lib/server/security';
import { parseCSV, exportCSV } from '../lib/csv';
const passwords = {
  admin: 'test-admin-long-password',
  owner: 'test-owner-long-password',
  picker: 'test-picker-long-password',
  driver: 'test-driver-long-password',
};
async function setup() {
  const h = harness();
  await seedDemo(h.env, passwords);
  const t = h.sqlite.prepare('SELECT id FROM tenants').get() as { id: string };
  const user = h.sqlite
    .prepare("SELECT id FROM users WHERE role='owner'")
    .get() as { id: string };
  const raw = token();
  h.sqlite
    .prepare('INSERT INTO sessions VALUES (?,?,?)')
    .run(hash(raw), user.id, Date.now() + 3600000);
  return { ...h, tenant: t.id, cookie: `op_session=${raw}` };
}
const checkout = (h: Awaited<ReturnType<typeof setup>>, qty = 1) => ({
  customer: 'Internal Test',
  phone: '0000000000',
  email: '',
  address: 'Internal testing address',
  zoneId: (
    h.sqlite
      .prepare('SELECT id FROM zones WHERE tenantId=? ORDER BY fee LIMIT 1')
      .get(h.tenant) as { id: string }
  ).id,
  notes: 'Test only',
  paymentMethod: 'Cash on delivery',
  idempotency: crypto.randomUUID(),
  items: [
    {
      productId: (
        h.sqlite
          .prepare(
            "SELECT id FROM products WHERE tenantId=? AND category='Audio' LIMIT 1",
          )
          .get(h.tenant) as { id: string }
      ).id,
      quantity: qty,
      variant: 'Charcoal',
      custom: {},
    },
  ],
});
void test('Tenant isolation: foreign tenant products, orders, employees and settings cannot be read or modified', async () => {
  const h = await setup();
  const date = new Date().toISOString();
  h.sqlite
    .prepare('INSERT INTO tenants (id,name,slug,createdAt) VALUES (?,?,?,?)')
    .run('other-tenant', 'Test fixture only', 'other-fixture', date);
  h.sqlite
    .prepare(
      'INSERT INTO products (id,tenantId,name,sku,price,stock,createdAt) VALUES (?,?,?,?,?,?,?)',
    )
    .run(
      'other-product',
      'other-tenant',
      'Private product',
      'OTHER',
      5000,
      10,
      date,
    );
  h.sqlite
    .prepare('INSERT INTO zones (id,tenantId,name,fee) VALUES (?,?,?,?)')
    .run('other-zone', 'other-tenant', 'Private zone', 100);
  h.sqlite
    .prepare(
      'INSERT INTO orders (id,tenantId,reference,customer,phone,address,zoneId,subtotal,deliveryFee,total,idempotency,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
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
  const read = await h.request(
    'orders/other-order',
    'GET',
    undefined,
    h.cookie,
  );
  assert.equal(read.status, 404);
  const write = await h.request(
    'orders/other-order',
    'PATCH',
    { version: 0, status: 'Confirmed' },
    h.cookie,
  );
  assert.equal(write.status, 404);
  const update = await h.request(
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
  );
  assert.equal(update.status, 404);
  const input = checkout(h);
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
    (
      await h.request(
        'store/internal-demo',
        'GET',
        undefined,
        '',
        'https://other-fixture.inchouf.com',
      )
    ).status,
    404,
  );
  assert.equal(
    (
      h.sqlite
        .prepare('SELECT stock FROM products WHERE id=?')
        .get('other-product') as { stock: number }
    ).stock,
    10,
  );
});
void test('Composite foreign keys reject cross-tenant line items and assignments at database level', async () => {
  const h = await setup();
  h.sqlite
    .prepare('INSERT INTO tenants (id,name,slug,createdAt) VALUES (?,?,?,?)')
    .run('other', 'Fixture', 'other-fixture', new Date().toISOString());
  h.sqlite
    .prepare(
      'INSERT INTO products (id,tenantId,name,sku,price,stock,createdAt) VALUES (?,?,?,?,?,?,?)',
    )
    .run('alien', 'other', 'Other', 'X', 100, 10, new Date().toISOString());
  const response = await h.request(
    'store/internal-demo/orders',
    'POST',
    checkout(h),
  );
  assert.equal(response.status, 201);
  const order = (await response.json()) as { id: string };
  assert.throws(
    () =>
      h.sqlite
        .prepare(
          'INSERT INTO items(id,tenantId,orderId,productId,name,quantity,price) VALUES (?,?,?,?,?,?,?)',
        )
        .run('invalid', 'other', order.id, 'alien', 'Other', 1, 100),
    /FOREIGN KEY/,
  );
  assert.equal(
    (
      h.sqlite
        .prepare('SELECT stock FROM products WHERE id=?')
        .get('alien') as { stock: number }
    ).stock,
    10,
  );
  assert.throws(
    () =>
      h.sqlite
        .prepare('UPDATE orders SET driverId=? WHERE id=?')
        .run('non-member', order.id),
    /FOREIGN KEY/,
  );
});
void test('Checkout reprices on server, reserves stock atomically, rejects overselling and duplicate submits', async () => {
  const h = await setup();
  const input = checkout(h);
  const product = input.items[0].productId;
  const before = h.sqlite
    .prepare('SELECT stock FROM products WHERE id=?')
    .get(product) as { stock: number };
  const res = await h.request('store/internal-demo/orders', 'POST', input);
  assert.equal(res.status, 201);
  const out = (await res.json()) as {
    total: number;
    trackingUrl: string;
    id: string;
  };
  assert.equal(out.total, 8200);
  assert.equal(
    (
      h.sqlite
        .prepare('SELECT stock FROM products WHERE id=?')
        .get(product) as { stock: number }
    ).stock,
    before.stock - 1,
  );
  assert.equal(
    (await h.request('store/internal-demo/orders', 'POST', input)).status,
    409,
  );
  assert.equal(
    (
      await h.request('store/internal-demo/orders', 'POST', {
        ...checkout(h),
        total: 1,
      })
    ).status,
    400,
  );
  const over = checkout(h, 100);
  assert.equal(
    (await h.request('store/internal-demo/orders', 'POST', over)).status,
    409,
  );
  assert.equal(
    (h.sqlite.prepare('SELECT COUNT(*) n FROM orders').get() as { n: number })
      .n,
    1,
  );
  const tracking = out.trackingUrl.split('/').pop();
  const tracked = await h.request(`store/internal-demo/track/${tracking}`);
  assert.equal(tracked.status, 200);
  const data = JSON.stringify(await tracked.json());
  assert.ok(!data.includes('0000000000'));
  assert.ok(!data.includes('Internal testing address'));
  assert.ok(!data.includes('trackingHash'));
  assert.equal(
    (
      await h.request(
        `orders/${out.id}/tracking`,
        'POST',
        { revoke: true },
        h.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await h.request(`store/internal-demo/track/${tracking}`)).status,
    404,
  );
});
void test('Order state machine, optimistic concurrency and single inventory restoration', async () => {
  const h = await setup();
  const input = checkout(h);
  const out = (await (
    await h.request('store/internal-demo/orders', 'POST', input)
  ).json()) as { id: string };
  assert.equal(
    (
      await h.request(
        `orders/${out.id}`,
        'PATCH',
        { version: 0, status: 'Delivered' },
        h.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}`,
        'PATCH',
        { version: 0, status: 'Confirmed' },
        h.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}`,
        'PATCH',
        { version: 0, status: 'Picking' },
        h.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}`,
        'PATCH',
        { version: 1, status: 'Cancelled', reason: 'Customer cancelled' },
        h.cookie,
      )
    ).status,
    200,
  );
  const p = input.items[0].productId;
  const stock = (
    h.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(p) as {
      stock: number;
    }
  ).stock;
  await h.request(
    `orders/${out.id}`,
    'PATCH',
    { version: 2, note: 'Checked' },
    h.cookie,
  );
  assert.equal(
    (
      h.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(p) as {
        stock: number;
      }
    ).stock,
    stock,
  );
});
void test('Roles, suspension, CSRF, expired sessions, and login throttling are enforced server-side', async () => {
  const h = await setup();
  const p = h.sqlite
    .prepare("SELECT id FROM users WHERE role='picker'")
    .get() as { id: string };
  const raw = token();
  h.sqlite
    .prepare('INSERT INTO sessions VALUES (?,?,?)')
    .run(hash(raw), p.id, Date.now() + 50000);
  assert.equal(
    (await h.request('products', 'GET', undefined, `op_session=${raw}`)).status,
    403,
  );
  assert.equal(
    (await h.request('admin/tenants', 'GET', undefined, h.cookie)).status,
    403,
  );
  assert.equal((await h.request('orders', 'GET')).status, 401);
  assert.equal(
    (
      await h.request(
        'logout',
        'POST',
        {},
        h.cookie,
        'http://test.invalid',
        'https://evil.invalid',
      )
    ).status,
    403,
  );
  h.sqlite.prepare('UPDATE sessions SET expires=0 WHERE id=?').run(hash(raw));
  assert.equal(
    (await h.request('me', 'GET', undefined, `op_session=${raw}`)).status,
    401,
  );
  h.sqlite.prepare('UPDATE tenants SET active=0 WHERE id=?').run(h.tenant);
  assert.equal(
    (await h.request('orders', 'GET', undefined, h.cookie)).status,
    403,
  );
  assert.equal((await h.request('store/internal-demo')).status, 404);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await h.request('login', 'POST', {
          email: 'unknown@test.invalid',
          password: 'wrong',
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await h.request('login', 'POST', {
        email: 'unknown@test.invalid',
        password: 'wrong',
      })
    ).status,
    429,
  );
});
void test('Proof file scope, approved-version locking and production gate', async () => {
  const h = await setup();
  const out = (await (
    await h.request('store/internal-demo/orders', 'POST', checkout(h))
  ).json()) as { id: string; trackingUrl: string };
  const id = crypto.randomUUID();
  h.sqlite
    .prepare(
      'INSERT INTO files (id,tenantId,orderId,name,type,size,createdAt) VALUES (?,?,?,?,?,?,?)',
    )
    .run(
      id,
      h.tenant,
      out.id,
      'proof.png',
      'image/png',
      10,
      new Date().toISOString(),
    );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}/proofs`,
        'POST',
        { fileId: id, note: 'Please review' },
        h.cookie,
      )
    ).status,
    201,
  );
  await h.request(
    `orders/${out.id}`,
    'PATCH',
    { version: 0, status: 'Confirmed' },
    h.cookie,
  );
  await h.request(
    `orders/${out.id}`,
    'PATCH',
    { version: 1, status: 'Picking' },
    h.cookie,
  );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}`,
        'PATCH',
        { version: 2, status: 'Packed' },
        h.cookie,
      )
    ).status,
    409,
  );
  const proof = h.sqlite.prepare('SELECT id FROM proofs').get() as {
    id: string;
  };
  const tracking = out.trackingUrl.split('/').pop();
  assert.equal(
    (
      await h.request(
        `store/internal-demo/track/${tracking}/proofs/${proof.id}`,
        'POST',
        { decision: 'Approved', feedback: '' },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}`,
        'PATCH',
        { version: 2, status: 'Packed' },
        h.cookie,
      )
    ).status,
    200,
  );
  assert.throws(
    () =>
      h.sqlite
        .prepare("UPDATE proofs SET note='changed' WHERE id=?")
        .run(proof.id),
    /PROOF_LOCKED/,
  );
  assert.equal(
    (
      await h.request(
        `orders/${out.id}/proofs`,
        'POST',
        { fileId: id, note: 'Replacement' },
        h.cookie,
      )
    ).status,
    409,
  );
});
void test('Passwords are salted and verified; slug parsing and CSV formula injection protection', async () => {
  const a = await passwordHash('long-password-for-test');
  const b = await passwordHash('long-password-for-test');
  assert.notEqual(a, b);
  assert.equal(await passwordMatches('long-password-for-test', a), true);
  assert.equal(await passwordMatches('wrong', a), false);
  assert.equal(hostTenant('internal-demo.inchouf.com'), 'internal-demo');
  assert.equal(hostTenant('app.inchouf.com'), null);
  assert.deepEqual(parseCSV('a,b\n"hello, world","a""b"'), [
    ['a', 'b'],
    ['hello, world', 'a"b'],
  ]);
  assert.match(exportCSV([['=HYPERLINK("bad")']]), /"'=HYPERLINK/);
});
