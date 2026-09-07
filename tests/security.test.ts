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
import { supabaseJsonHeaders } from '../lib/server/supabase-headers';
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

async function cookieForRole(
  h: Awaited<ReturnType<typeof setup>>,
  role: string,
) {
  const user = (await h.get<{ id: string }>(
    'SELECT id FROM users WHERE role=? LIMIT 1',
    role,
  ))!;
  const raw = token();
  await h.run(
    'INSERT INTO sessions (id,userId,expires) VALUES (?,?,?)',
    hash(raw),
    user.id,
    Date.now() + 3600000,
  );
  return `op_session=${raw}`;
}

async function createPackedOrder(h: Awaited<ReturnType<typeof setup>>) {
  const created = (await (
    await h.request('store/internal-demo/orders', 'POST', await checkout(h))
  ).json()) as { id: string };
  for (const [version, status] of [
    [0, 'Confirmed'],
    [1, 'Picking'],
    [2, 'Packed'],
  ] as const) {
    const response = await h.request(
      `orders/${created.id}`,
      'PATCH',
      { version, status },
      h.cookie,
    );
    assert.equal(response.status, 200, await response.text());
  }
  return created.id;
}

async function createDeliveredExternalOrder(
  h: Awaited<ReturnType<typeof setup>>,
  provider = 'Fast Courier',
) {
  const id = await createPackedOrder(h);
  let response = await h.request(
    `orders/${id}`,
    'PATCH',
    {
      version: 3,
      status: 'Out for Delivery',
      deliveryMethod: 'external_courier',
      deliveryProvider: provider,
    },
    h.cookie,
  );
  assert.equal(response.status, 200, await response.text());
  response = await h.request(
    `orders/${id}`,
    'PATCH',
    { version: 4, status: 'Delivered' },
    h.cookie,
  );
  assert.equal(response.status, 200, await response.text());
  return id;
}

void test('production bootstrap creates only the first platform admin', async () => {
  const h = await harness();
  const adminHost = 'https://admin.inchouf.com';
  const tokenHeader = { 'X-Bootstrap-Token': 'test-only-bootstrap-token' };
  const input = {
    email: 'ADMIN@INCHOUF.COM',
    password: 'first-admin-password',
    name: 'InChouf Admin',
  };

  assert.equal(
    (await h.request('bootstrap', 'POST', input, '', adminHost)).status,
    404,
  );
  assert.equal(
    (
      await h.request(
        'bootstrap',
        'POST',
        input,
        '',
        adminHost,
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
    adminHost,
    adminHost,
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
  const login = await h.request(
    'login',
    'POST',
    {
      email: 'admin@inchouf.com',
      password: input.password,
    },
    '',
    adminHost,
    adminHost,
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')!.match(/op_session=([^;]+)/)!;
  const me = await h.request(
    'me',
    'GET',
    undefined,
    `op_session=${cookie[1]}`,
    adminHost,
    adminHost,
  );
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()) as unknown, {
    user: {
      id: (await h.get<{ id: string }>('SELECT id FROM users LIMIT 1'))!.id,
      tenantId: null,
      email: 'admin@inchouf.com',
      name: 'InChouf Admin',
      role: 'super_admin',
      active: 1,
    },
    tenant: null,
  });
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
        adminHost,
        adminHost,
        tokenHeader,
      )
    ).status,
    409,
  );
});

void test('Supabase API keys are not sent as JWT bearer tokens', () => {
  const publishable = supabaseJsonHeaders('sb_publishable_example');
  assert.equal(publishable.get('apikey'), 'sb_publishable_example');
  assert.equal(publishable.has('authorization'), false);

  const secret = supabaseJsonHeaders('sb_secret_example');
  assert.equal(secret.get('apikey'), 'sb_secret_example');
  assert.equal(secret.has('authorization'), false);

  const legacy = supabaseJsonHeaders('eyJhbGciOiJIUzI1NiJ9.example');
  assert.equal(
    legacy.get('authorization'),
    'Bearer eyJhbGciOiJIUzI1NiJ9.example',
  );
});

void test('Supabase RPC handles rate-limit writes with RETURNING', async () => {
  const h = await harness();
  const first = await h.get<{
    result: { rows: { count: number }[]; count: number };
  }>(
    'SELECT op_query(?, ?::jsonb) result',
    'INSERT INTO limits (key,count,expires) VALUES ($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=limits.count+1 RETURNING count',
    JSON.stringify(['rpc-returning-login-test', Date.now() + 600000]),
  );
  assert.deepEqual(first!.result, { rows: [{ count: 1 }], count: 1 });

  const second = await h.get<{
    result: { rows: { count: number }[]; count: number };
  }>(
    'SELECT op_query(?, ?::jsonb) result',
    'INSERT INTO limits (key,count,expires) VALUES ($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=limits.count+1 RETURNING count',
    JSON.stringify(['rpc-returning-login-test', Date.now() + 600000]),
  );
  assert.deepEqual(second!.result, { rows: [{ count: 2 }], count: 1 });
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

void test('super admin business search and logo creation stay authorized and tenant-scoped', async () => {
  const h = await setup();
  const adminCookie = await cookieForRole(h, 'super_admin');
  const unauthorized = await h.request(
    'admin/tenants?q=internal-demo',
    'GET',
    undefined,
    h.cookie,
  );
  assert.equal(unauthorized.status, 403);

  const existing = await h.request(
    'admin/tenants?q=internal-demo',
    'GET',
    undefined,
    adminCookie,
  );
  const existingText = await existing.text();
  assert.equal(existing.status, 200, existingText);
  const existingData = JSON.parse(existingText) as {
    total: number;
    tenants: { slug: string }[];
  };
  assert.equal(existingData.total, 1);
  assert.equal(existingData.tenants[0].slug, 'internal-demo');

  const form = new FormData();
  form.set('name', 'Logo Test Business');
  form.set('slug', 'logo-test');
  form.set('ownerName', 'Logo Owner');
  form.set('email', 'logo-owner@example.com');
  form.set('password', 'logo-owner-password');
  form.set(
    'logo',
    new File(
      [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0])],
      'شعار.png',
      { type: 'image/png' },
    ),
  );
  const created = await h.request(
    'admin/tenants',
    'POST',
    form,
    adminCookie,
  );
  assert.equal(created.status, 201, await created.text());

  const tenant = (await h.get<{ id: string; settings: string }>(
    'SELECT id,settings FROM tenants WHERE slug=?',
    'logo-test',
  ))!;
  const logoId = JSON.parse(tenant.settings).branding.logoId as string;
  assert.ok(logoId);
  assert.equal(h.blobs.has(`${tenant.id}/${logoId}`), true);

  const logo = await h.request('store/logo-test/logo');
  assert.equal(logo.status, 200, await logo.text());
  assert.equal(logo.headers.get('content-type'), 'image/png');
  assert.equal((await h.request('store/internal-demo/logo')).status, 404);

  const search = await h.request(
    'admin/tenants?q=logo-test.inchouf.com',
    'GET',
    undefined,
    adminCookie,
  );
  const searchData = (await search.json()) as {
    total: number;
    tenants: { slug: string; ownerEmail: string }[];
  };
  assert.equal(searchData.total, 1);
  assert.equal(searchData.tenants[0].slug, 'logo-test');
  assert.equal(searchData.tenants[0].ownerEmail, 'logo-owner@example.com');

  const none = await h.request(
    'admin/tenants?q=does-not-exist',
    'GET',
    undefined,
    adminCookie,
  );
  assert.equal(((await none.json()) as { total: number }).total, 0);
  const cleared = await h.request('admin/tenants', 'GET', undefined, adminCookie);
  assert.equal(((await cleared.json()) as { total: number }).total, 2);
});

void test('invalid business logos are rejected before tenant creation', async () => {
  const h = await setup();
  const adminCookie = await cookieForRole(h, 'super_admin');
  const form = new FormData();
  form.set('name', 'Bad Logo Business');
  form.set('slug', 'bad-logo');
  form.set('ownerName', 'Bad Logo Owner');
  form.set('email', 'bad-logo@example.com');
  form.set('password', 'bad-logo-password');
  form.set('logo', new File([Uint8Array.from([1, 2, 3])], 'bad.gif'));

  const response = await h.request('admin/tenants', 'POST', form, adminCookie);
  assert.equal(response.status, 400, await response.text());
  assert.equal(
    (await h.get<{ count: number }>(
      "SELECT COUNT(*) count FROM tenants WHERE slug='bad-logo'",
    ))!.count,
    0,
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

void test('customer search/profile are tenant scoped and order exports require manager roles', async () => {
  const h = await setup();
  await h.request('store/internal-demo/orders', 'POST', await checkout(h));

  const customers = await h.request('customers?q=internal', 'GET', undefined, h.cookie);
  const customersText = await customers.text();
  assert.equal(customers.status, 200, customersText);
  const customerRows = JSON.parse(customersText) as {
    phone: string;
    name: string;
    orders: number;
    outstanding: number;
  }[];
  assert.equal(customerRows.length, 1);
  assert.equal(customerRows[0].phone, '0000000000');
  assert.equal(customerRows[0].orders, 1);
  assert.ok(customerRows[0].outstanding > 0);

  const profile = await h.request(
    `customers/${encodeURIComponent('0000000000')}`,
    'GET',
    undefined,
    h.cookie,
  );
  const profileText = await profile.text();
  assert.equal(profile.status, 200, profileText);
  const profileData = JSON.parse(profileText) as {
    customer: { phone: string; orders: number };
    orders: { reference: string }[];
  };
  assert.equal(profileData.customer.phone, '0000000000');
  assert.equal(profileData.orders.length, 1);

  const pickerCookie = await cookieForRole(h, 'picker');
  assert.equal(
    (await h.request('orders/export', 'GET', undefined, pickerCookie)).status,
    403,
  );
  const exported = await h.request('orders/export', 'GET', undefined, h.cookie);
  const exportedText = await exported.text();
  assert.equal(exported.status, 200, exportedText);
  assert.match(exportedText, /"Reference","Customer","Phone"/);
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

void test('packed delivery orders require explicit internal driver or external courier', async () => {
  const h = await setup();
  const driver = (await h.get<{ id: string }>(
    "SELECT id FROM users WHERE role='delivery_manager'",
  ))!;
  const externalOrder = await createPackedOrder(h);

  const blocked = await h.request(
    `orders/${externalOrder}`,
    'PATCH',
    { version: 3, status: 'Out for Delivery' },
    h.cookie,
  );
  assert.equal(blocked.status, 400, await blocked.text());
  assert.equal(
    (
      await h.get<{ driverId: string | null }>(
        'SELECT driverId FROM orders WHERE id=?',
        externalOrder,
      )
    )!.driverId,
    null,
  );

  const response = await h.request(
    `orders/${externalOrder}`,
    'PATCH',
    {
      version: 3,
      status: 'Out for Delivery',
      deliveryMethod: 'external_courier',
      deliveryProvider: 'Fast Courier',
    },
    h.cookie,
  );
  const responseText = await response.text();
  assert.equal(response.status, 200, responseText);
  const detail = JSON.parse(responseText) as {
    order: {
      status: string;
      driverId: string | null;
      deliveryMethod: string;
      deliveryProvider: string;
      deliveryStatus: string;
    };
  };
  assert.equal(detail.order.status, 'Out for Delivery');
  assert.equal(detail.order.driverId, null);
  assert.equal(detail.order.deliveryMethod, 'external_courier');
  assert.equal(detail.order.deliveryProvider, 'Fast Courier');
  assert.equal(detail.order.deliveryStatus, 'On the way');

  const internalOrder = await createPackedOrder(h);
  const internal = await h.request(
    `orders/${internalOrder}`,
    'PATCH',
    {
      version: 3,
      status: 'Out for Delivery',
      deliveryMethod: 'internal_driver',
      driverId: driver.id,
    },
    h.cookie,
  );
  assert.equal(internal.status, 200, await internal.text());
});

void test('full COD cash collection marks the order paid', async () => {
  const h = await setup();
  const id = await createDeliveredExternalOrder(h);
  const order = (await h.get<{ total: number }>(
    'SELECT total FROM orders WHERE id=?',
    id,
  ))!;
  const response = await h.request(
    `orders/${id}`,
    'PATCH',
    { version: 5, cashCollected: order.total },
    h.cookie,
  );
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const detail = JSON.parse(text) as {
    order: { payment: string; cashCollected: number };
    events: { detail: string }[];
  };
  assert.equal(detail.order.payment, 'Paid');
  assert.equal(detail.order.cashCollected, order.total);
  assert.ok(detail.events.some((e) => e.detail.includes('Payment: Unpaid -> Paid')));
});

void test('cash settlements calculate variance, update balanced COD orders and prevent duplicates', async () => {
  const h = await setup();
  await createDeliveredExternalOrder(h, 'Fleet Co');
  await createDeliveredExternalOrder(h, 'Fleet Co');
  const expected = Number((await h.get<{ total: number }>(
    "SELECT SUM(total) total FROM orders WHERE tenantId=? AND deliveryProvider='Fleet Co'",
    h.tenant,
  ))!.total);

  const missing = await h.request(
    'settlements',
    'POST',
    {
      method: 'external_courier',
      provider: 'Fleet Co',
      actual: expected - 2700,
    },
    h.cookie,
  );
  const missingText = await missing.text();
  assert.equal(missing.status, 201, missingText);
  assert.deepEqual(JSON.parse(missingText), {
    id: JSON.parse(missingText).id,
    expected,
    actual: expected - 2700,
    variance: -2700,
    status: 'missing',
  });
  assert.equal(
    (
      await h.request(
        'settlements',
        'POST',
        {
          method: 'external_courier',
          provider: 'Fleet Co',
          actual: expected,
        },
        h.cookie,
      )
    ).status,
    409,
  );

  await createDeliveredExternalOrder(h, 'Balanced Co');
  const balancedExpected = Number((await h.get<{ total: number }>(
    "SELECT SUM(total) total FROM orders WHERE tenantId=? AND deliveryProvider='Balanced Co'",
    h.tenant,
  ))!.total);
  const balanced = await h.request(
    'settlements',
    'POST',
    {
      method: 'external_courier',
      provider: 'Balanced Co',
      actual: balancedExpected,
    },
    h.cookie,
  );
  assert.equal(balanced.status, 201, await balanced.text());
  assert.equal(
    (
      await h.get<{ payment: string; cashCollected: number }>(
        "SELECT payment,cashCollected FROM orders WHERE tenantId=? AND deliveryProvider='Balanced Co'",
        h.tenant,
      )
    )!.payment,
    'Paid',
  );
  const pickerCookie = await cookieForRole(h, 'picker');
  assert.equal(
    (
      await h.request(
        'settlements',
        'POST',
        {
          method: 'external_courier',
          provider: 'Nope',
          actual: 0,
        },
        pickerCookie,
      )
    ).status,
    403,
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
