import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const creds = JSON.parse(
  readFileSync('.demo-credentials.json', 'utf8'),
) as Record<string, string>;
async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(`${role}@demo.inchouf.test`);
  await page.getByLabel('Password', { exact: true }).fill(creds[role]);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/pos$/);
}
test('Storefront checkout appears in owner POS and customer tracking', async ({
  page,
}) => {
  await page.goto('/store/internal-demo');
  await expect(
    page.getByRole('heading', { name: 'The collection.' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View Studio headphones', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: /Add to bag/ }).click();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await page
    .getByLabel('Full name', { exact: true })
    .fill('Internal E2E customer');
  await page.getByLabel('Phone number', { exact: true }).fill('0000000000');
  await page
    .getByLabel('Delivery address', { exact: true })
    .fill('Internal demo address, test only');
  await page.getByRole('button', { name: /Place order/ }).click();
  await expect(
    page.getByText('Order received.', { exact: true }),
  ).toBeVisible();
  const tracking = await page
    .getByRole('link', { name: 'Track your order' })
    .getAttribute('href');
  await page.getByRole('link', { name: 'Track your order' }).click();
  await expect(
    page.getByRole('heading', { name: 'Good things are in motion.' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/tracking-desktop.png',
    fullPage: true,
  });
  await login(page, 'owner');
  await expect(page.getByText('Internal E2E customer').first()).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/pos-desktop.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByLabel('Search orders').fill('Internal E2E customer');
  await page
    .getByRole('button', { name: 'Confirm order', exact: true })
    .first()
    .click();
  await expect(
    page.locator('.toast-message').getByText(/updated/i),
  ).toBeVisible();
  await page.goto(tracking!);
  await expect(
    page.locator('.badge').getByText('Confirmed', { exact: true }),
  ).toBeVisible();
});
test('Owner catalog, role-specific workspace and admin controls', async ({
  page,
}) => {
  await login(page, 'owner');
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A catalog worth keeping.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page
    .getByLabel('Product name', { exact: true })
    .fill('Internal E2E test product');
  await page.getByLabel('SKU', { exact: true }).fill(`E2E-${Date.now()}`);
  await page.getByLabel('Price ($)', { exact: true }).fill('15');
  await page.getByLabel('Stock quantity', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Internal E2E test product' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Storefront', exact: true }).click();
  await expect(
    page.getByText('Offer the optional 3D Experience'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'picker');
  await expect(
    page.getByRole('heading', { name: 'Know what comes next.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Products', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'admin');
  await expect(
    page.getByRole('heading', { name: 'Your platform, at a glance.' }),
  ).toBeVisible();
  await expect(
    page.getByText('InChouf Internal Demo', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/admin-desktop.png',
    fullPage: true,
  });
});
test('Mobile storefront, bag and 3D reduced-motion fallback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/store/internal-demo');
  await expect(
    page.getByRole('heading', { name: 'The collection.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'docs/screenshots/store-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Explore the 3D Experience' }).click();
  await expect(
    page.getByText(
      'Standard view is optimized for this device and your motion preferences.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View Studio headphones', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: /Add to bag/ }).click();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'docs/screenshots/checkout-mobile.png' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'docs/screenshots/marketing-mobile.png',
    fullPage: true,
  });
});
test('Picker packing, assigned-driver delivery and private tracking', async ({
  page,
}) => {
  await login(page, 'owner');
  const catalog = await (await page.request.get('/api/catalog')).json();
  const product = catalog.products.find(
    (p: { name: string }) => p.name === 'Personalized notebook',
  );
  const team = await (await page.request.get('/api/team')).json();
  const picker = team.find((u: { role: string }) => u.role === 'picker');
  const driver = team.find(
    (u: { role: string }) => u.role === 'delivery_manager',
  );
  const origin = 'http://localhost:3000';
  const created = await page.request.post('/api/orders', {
    headers: { Origin: origin },
    data: {
      customer: 'Internal workflow test',
      phone: '0000000001',
      email: '',
      address: 'Internal test location only',
      zoneId: catalog.zones[0].id,
      paymentMethod: 'Cash on delivery',
      notes: 'Automated internal test',
      idempotency: crypto.randomUUID(),
      items: [
        {
          productId: product.id,
          quantity: 1,
          variant: '',
          custom: { 'Name on cover': 'Demo workflow' },
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const order = await created.json();
  expect(
    (
      await page.request.patch(`/api/orders/${order.id}`, {
        headers: { Origin: origin },
        data: {
          version: 0,
          status: 'Confirmed',
          employeeId: picker.id,
          driverId: driver.id,
        },
      })
    ).status(),
  ).toBe(200);
  await login(page, 'picker');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByLabel('Search orders').fill(order.reference);
  await page
    .getByRole('button', { name: 'Start picking', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Mark as packed', exact: true })
    .click();
  await expect(
    page.locator('.badge').getByText('Packed', { exact: true }).first(),
  ).toBeVisible();
  await page.goto('/pos');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'driver');
  await page.getByLabel('Search orders').fill(order.reference);
  await page
    .getByRole('button', { name: 'Hand off for delivery', exact: true })
    .click();
  await expect(
    page
      .locator('.badge')
      .getByText('Out for Delivery', { exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Mark delivered', exact: true })
    .click();
  await expect(
    page.locator('.badge').getByText('Delivered', { exact: true }).first(),
  ).toBeVisible();
  await page.goto(order.trackingUrl);
  await expect(
    page.getByRole('heading', { name: 'A good delivery.' }),
  ).toBeVisible();
});
test('Mobile POS navigation and order table remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'owner');
  await expect(
    page.getByRole('heading', { name: 'A clearer day starts here.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-mobile="true"]')).toBeHidden();
  await expect(page.getByLabel('Search orders')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'docs/screenshots/pos-mobile.png',
    fullPage: true,
  });
});
