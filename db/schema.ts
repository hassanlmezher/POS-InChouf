import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  foreignKey,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const tenants = sqliteTable('tenants', {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  active: integer().notNull().default(1),
  plan: text().notNull().default('Starter'),
  price: integer().notNull().default(2000),
  subscription: text().notNull().default('trial'),
  trialStart: text(),
  trialEnd: text(),
  renewalDate: text(),
  suspendedDate: text(),
  settings: text().notNull().default('{}'),
  createdAt: text().notNull(),
});
export const users = sqliteTable(
  'users',
  {
    id: text().primaryKey(),
    tenantId: text().references(() => tenants.id),
    email: text().notNull().unique(),
    name: text().notNull(),
    role: text().notNull(),
    password: text().notNull(),
    active: integer().notNull().default(1),
    createdAt: text().notNull(),
  },
  (t) => [uniqueIndex('users_tenant_id').on(t.tenantId, t.id)],
);
export const sessions = sqliteTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id),
    expires: integer().notNull(),
  },
  (t) => [index('sessions_user').on(t.userId)],
);
export const products = sqliteTable(
  'products',
  {
    id: text().primaryKey(),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    name: text().notNull(),
    description: text().notNull().default(''),
    category: text().notNull().default('General'),
    sku: text().notNull(),
    price: integer().notNull(),
    stock: integer().notNull(),
    lowStock: integer().notNull().default(5),
    active: integer().notNull().default(1),
    image: text().notNull().default(''),
    variants: text().notNull().default('[]'),
    customFields: text().notNull().default('[]'),
    createdAt: text().notNull(),
  },
  (t) => [
    uniqueIndex('products_tenant_id').on(t.tenantId, t.id),
    uniqueIndex('products_tenant_sku').on(t.tenantId, t.sku),
    check('stock_nonnegative', sql`${t.stock} >= 0`),
    check('price_nonnegative', sql`${t.price} >= 0`),
  ],
);
export const zones = sqliteTable(
  'zones',
  {
    id: text().primaryKey(),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    name: text().notNull(),
    fee: integer().notNull(),
    freeAbove: integer(),
    minimum: integer().notNull().default(0),
    active: integer().notNull().default(1),
    notes: text().notNull().default(''),
  },
  (t) => [uniqueIndex('zones_tenant_id').on(t.tenantId, t.id)],
);
export const orders = sqliteTable(
  'orders',
  {
    id: text().primaryKey(),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    reference: text().notNull(),
    customer: text().notNull(),
    phone: text().notNull(),
    email: text().notNull().default(''),
    address: text().notNull(),
    zoneId: text().notNull(),
    status: text().notNull().default('New'),
    payment: text().notNull().default('Unpaid'),
    paymentMethod: text().notNull().default('Cash on delivery'),
    subtotal: integer().notNull(),
    deliveryFee: integer().notNull(),
    total: integer().notNull(),
    notes: text().notNull().default(''),
    employeeId: text(),
    driverId: text(),
    deliveryStatus: text().notNull().default('Pending'),
    cashCollected: integer().notNull().default(0),
    reason: text().notNull().default(''),
    trackingHash: text().unique(),
    idempotency: text().notNull(),
    version: integer().notNull().default(0),
    createdAt: text().notNull(),
    updatedAt: text().notNull(),
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
export const items = sqliteTable(
  'items',
  {
    id: text().primaryKey(),
    tenantId: text().notNull(),
    orderId: text().notNull(),
    productId: text().notNull(),
    name: text().notNull(),
    quantity: integer().notNull(),
    price: integer().notNull(),
    variant: text().notNull().default(''),
    custom: text().notNull().default('{}'),
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
export const events = sqliteTable(
  'events',
  {
    id: text().primaryKey(),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    orderId: text(),
    actor: text().notNull(),
    action: text().notNull(),
    detail: text().notNull().default(''),
    public: integer().notNull().default(0),
    createdAt: text().notNull(),
  },
  (t) => [
    index('events_order').on(t.tenantId, t.orderId),
    foreignKey({
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
  ],
);
export const proofs = sqliteTable(
  'proofs',
  {
    id: text().primaryKey(),
    tenantId: text().notNull(),
    orderId: text().notNull(),
    version: integer().notNull(),
    fileId: text().notNull(),
    note: text().notNull().default(''),
    status: text().notNull().default('Pending'),
    feedback: text().notNull().default(''),
    createdAt: text().notNull(),
  },
  (t) => [
    uniqueIndex('proof_version').on(t.tenantId, t.orderId, t.version),
    foreignKey({
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
  ],
);
export const files = sqliteTable(
  'files',
  {
    id: text().primaryKey(),
    tenantId: text()
      .notNull()
      .references(() => tenants.id),
    orderId: text(),
    name: text().notNull(),
    type: text().notNull(),
    size: integer().notNull(),
    createdAt: text().notNull(),
  },
  (t) => [
    index('files_tenant').on(t.tenantId),
    foreignKey({
      columns: [t.tenantId, t.orderId],
      foreignColumns: [orders.tenantId, orders.id],
    }),
  ],
);
export const limits = sqliteTable('limits', {
  key: text().primaryKey(),
  count: integer().notNull(),
  expires: integer().notNull(),
});
export const platformEvents = sqliteTable('platformEvents', {
  id: text().primaryKey(),
  actor: text().notNull(),
  action: text().notNull(),
  detail: text().notNull(),
  createdAt: text().notNull(),
});
