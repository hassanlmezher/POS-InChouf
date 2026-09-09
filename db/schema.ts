import {
  pgTable,
  text,
  integer,
  bigint,
  uniqueIndex,
  index,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  active: integer('active').notNull().default(1),
  plan: text('plan').notNull().default('Starter'),
  price: integer('price').notNull().default(2000),
  subscription: text('subscription').notNull().default('trial'),
  trialStart: text('trialstart'),
  trialEnd: text('trialend'),
  renewalDate: text('renewaldate'),
  suspendedDate: text('suspendeddate'),
  settings: text('settings').notNull().default('{}'),
  createdAt: text('createdat').notNull(),
});
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid').references(() => tenants.id),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    active: integer('active').notNull().default(1),
    createdAt: text('createdat').notNull(),
  },
  (t) => [uniqueIndex('users_tenant_id').on(t.tenantId, t.id)],
);
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('userid')
      .notNull()
      .references(() => users.id),
    expires: bigint('expires', { mode: 'number' }).notNull(),
  },
  (t) => [index('sessions_user').on(t.userId)],
);
export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('General'),
    sku: text('sku').notNull(),
    price: integer('price').notNull(),
    stock: integer('stock').notNull(),
    lowStock: integer('lowstock').notNull().default(5),
    active: integer('active').notNull().default(1),
    image: text('image').notNull().default(''),
    variants: text('variants').notNull().default('[]'),
    customFields: text('customfields').notNull().default('[]'),
    createdAt: text('createdat').notNull(),
  },
  (t) => [
    uniqueIndex('products_tenant_id').on(t.tenantId, t.id),
    uniqueIndex('products_tenant_sku').on(t.tenantId, t.sku),
    check('stock_nonnegative', sql`${t.stock} >= 0`),
    check('price_nonnegative', sql`${t.price} >= 0`),
  ],
);
export const zones = pgTable(
  'zones',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    fee: integer('fee').notNull(),
    freeAbove: integer('freeabove'),
    minimum: integer('minimum').notNull().default(0),
    active: integer('active').notNull().default(1),
    notes: text('notes').notNull().default(''),
  },
  (t) => [uniqueIndex('zones_tenant_id').on(t.tenantId, t.id)],
);
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid')
      .notNull()
      .references(() => tenants.id),
    reference: text('reference').notNull(),
    customer: text('customer').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull().default(''),
    address: text('address').notNull(),
    zoneId: text('zoneid').notNull(),
    status: text('status').notNull().default('New'),
    payment: text('payment').notNull().default('Unpaid'),
    paymentMethod: text('paymentmethod').notNull().default('Cash on delivery'),
    subtotal: integer('subtotal').notNull(),
    discountPercent: integer('discountpercent').notNull().default(0),
    discountAmount: integer('discountamount').notNull().default(0),
    deliveryFee: integer('deliveryfee').notNull(),
    total: integer('total').notNull(),
    notes: text('notes').notNull().default(''),
    employeeId: text('employeeid'),
    driverId: text('driverid'),
    deliveryStatus: text('deliverystatus').notNull().default('Pending'),
    cashCollected: integer('cashcollected').notNull().default(0),
    reason: text('reason').notNull().default(''),
    trackingHash: text('trackinghash').unique(),
    idempotency: text('idempotency').notNull(),
    version: integer('version').notNull().default(0),
    createdAt: text('createdat').notNull(),
    updatedAt: text('updatedat').notNull(),
  },
  (t) => [
    uniqueIndex('orders_tenant_id').on(t.tenantId, t.id),
    uniqueIndex('orders_idempotency').on(t.tenantId, t.idempotency),
    index('orders_queue').on(t.tenantId, t.status, t.createdAt),
    foreignKey({
      columns: [t.tenantId, t.zoneId],
      foreignColumns: [zones.tenantId, zones.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.employeeId],
      foreignColumns: [users.tenantId, users.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.driverId],
      foreignColumns: [users.tenantId, users.id],
    }),
  ],
);
export const items = pgTable(
  'items',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid').notNull(),
    orderId: text('orderid').notNull(),
    productId: text('productid').notNull(),
    name: text('name').notNull(),
    quantity: integer('quantity').notNull(),
    price: integer('price').notNull(),
    variant: text('variant').notNull().default(''),
    custom: text('custom').notNull().default('{}'),
  },
  (t) => [
    index('items_order').on(t.tenantId, t.orderId),
    foreignKey({
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.productId],
      foreignColumns: [products.tenantId, products.id],
    }),
    check('quantity_positive', sql`${t.quantity}>0`),
  ],
);
export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid')
      .notNull()
      .references(() => tenants.id),
    orderId: text('orderid'),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    detail: text('detail').notNull().default(''),
    public: integer('public').notNull().default(0),
    createdAt: text('createdat').notNull(),
  },
  (t) => [
    index('events_order').on(t.tenantId, t.orderId),
    foreignKey({
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
  ],
);
export const files = pgTable(
  'files',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenantid')
      .notNull()
      .references(() => tenants.id),
    orderId: text('orderid'),
    name: text('name').notNull(),
    type: text('type').notNull(),
    size: integer('size').notNull(),
    createdAt: text('createdat').notNull(),
  },
  (t) => [
    index('files_tenant').on(t.tenantId),
    foreignKey({
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
  ],
);
export const limits = pgTable('limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: bigint('expires', { mode: 'number' }).notNull(),
});
export const platformEvents = pgTable('platformevents', {
  id: text('id').primaryKey(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  detail: text('detail').notNull(),
  createdAt: text('createdat').notNull(),
});
