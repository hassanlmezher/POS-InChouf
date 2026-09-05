import { z } from 'zod';
import { checkoutInput, updateOrderInput } from './validation';
import { event, now, uid, stmt, one, rows, type Runtime, database } from './db';
import { fail, token, hash, requireRole } from './security';
import {
  transitions,
  settingsOf,
  type Tenant,
  type Product,
  type Variant,
  type CustomField,
  type Zone,
  type User,
  type Order,
  type Status,
} from '../types';
export async function placeOrder(
  env: Runtime,
  t: Tenant,
  input: z.infer<typeof checkoutInput>,
  actor = 'Customer',
) {
  const db = database(env);
  const existing = await one<{ id: string }>(
    db,
    'SELECT id FROM orders WHERE tenantId=? AND idempotency=?',
    t.id,
    input.idempotency,
  );
  if (existing)
    fail(
      409,
      'This order was already submitted. Use the tracking link saved after checkout.',
    );
  const zone = await one<Zone>(
    db,
    'SELECT * FROM zones WHERE tenantId=? AND id=? AND active=1',
    t.id,
    input.zoneId,
  );
  if (!zone) fail(400, 'Choose an available delivery zone.');
  if (!settingsOf(t).paymentOptions.includes(input.paymentMethod))
    fail(400, 'This payment method is unavailable.');
  const lines = [];
  let subtotal = 0;
  for (const item of input.items) {
    const p = await one<Product>(
      db,
      'SELECT * FROM products WHERE tenantId=? AND id=? AND active=1',
      t.id,
      item.productId,
    );
    if (!p) fail(400, 'A product is unavailable. Refresh your cart.');
    const variants = JSON.parse(p!.variants) as Variant[];
    const variant = variants.find((v) => v.name === item.variant);
    if (variants.length && !variant)
      fail(400, 'Please choose a valid product option.');
    if (!variants.length && item.variant) fail(400, 'Invalid product option.');
    const fields = JSON.parse(p!.customFields) as CustomField[];
    for (const key of Object.keys(item.custom)) {
      if (!fields.some((f) => f.name === key))
        fail(400, 'Unknown custom field.');
    }
    for (const field of fields) {
      const value = item.custom[field.name];
      if (field.required && !value?.trim())
        fail(400, `${field.name} is required.`);
      if (field.type === 'file' && value)
        fail(
          400,
          'Upload custom files through your private tracking page after placing the order.',
        );
    }
    const price = variant?.price ?? p!.price;
    subtotal += price * item.quantity;
    lines.push({ ...item, price, name: p!.name });
  }
  if (subtotal < zone!.minimum)
    fail(400, 'The minimum order amount for this zone has not been reached.');
  const fee =
    zone!.freeAbove !== null && subtotal >= zone!.freeAbove ? 0 : zone!.fee;
  const id = uid(),
    tracking = token(),
    date = now(),
    reference = `OP-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 4).toUpperCase()}`;
  await db.batch([
    stmt(
      db,
      'INSERT INTO orders (id,tenantId,reference,customer,phone,email,address,zoneId,paymentMethod,subtotal,deliveryFee,total,notes,trackingHash,idempotency,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      id,
      t.id,
      reference,
      input.customer,
      input.phone,
      input.email,
      input.address,
      zone!.id,
      input.paymentMethod,
      subtotal,
      fee,
      subtotal + fee,
      input.notes,
      hash(tracking),
      input.idempotency,
      date,
      date,
    ),
    ...lines.map((i) =>
      stmt(
        db,
        'INSERT INTO items (id,tenantId,orderId,productId,name,quantity,price,variant,custom) VALUES (?,?,?,?,?,?,?,?,?)',
        uid(),
        t.id,
        id,
        i.productId,
        i.name,
        i.quantity,
        i.price,
        i.variant,
        JSON.stringify(i.custom),
      ),
    ),
    event(db, t.id, actor, 'New', id, 'Order received', true),
  ]);
  return {
    id,
    reference,
    trackingUrl: `/store/${t.slug}/order/${tracking}`,
    total: subtotal + fee,
  };
}
export async function orderDetail(
  env: Runtime,
  tenantId: string,
  id: string,
  user?: User,
) {
  const db = database(env);
  const order = await one<Order>(
    db,
    'SELECT * FROM orders WHERE tenantId=? AND id=?',
    tenantId,
    id,
  );
  if (!order) fail(404, 'Order not found.');
  if (
    user?.role === 'picker' &&
    order!.employeeId &&
    order!.employeeId !== user.id
  )
    fail(403, 'This order is assigned to another employee.');
  if (user?.role === 'delivery_manager' && order!.driverId !== user.id)
    fail(403, 'This delivery is not assigned to you.');
  return {
    order,
    items: await rows(
      db,
      'SELECT * FROM items WHERE tenantId=? AND orderId=?',
      tenantId,
      id,
    ),
    events: await rows(
      db,
      'SELECT * FROM events WHERE tenantId=? AND orderId=? ORDER BY createdAt DESC',
      tenantId,
      id,
    ),
    proofs: await rows(
      db,
      'SELECT p.*, f.type AS contentType FROM proofs p JOIN files f ON f.id=p.fileId AND f.tenantId=p.tenantId WHERE p.tenantId=? AND p.orderId=? ORDER BY p.version DESC',
      tenantId,
      id,
    ),
  };
}
export async function updateOrder(
  env: Runtime,
  user: User,
  id: string,
  input: z.infer<typeof updateOrderInput>,
) {
  const db = database(env);
  const t = user.tenantId!;
  const { order: o } = await orderDetail(env, t, id, user);
  const order = o!;
  if (user.role === 'picker') {
    if (
      Object.keys(input).some((k) => !['version', 'status', 'note'].includes(k))
    )
      fail(403, 'Pickers can only update preparation and notes.');
    if (
      input.status &&
      !['Picking', 'Packed', 'Needs Attention'].includes(input.status)
    )
      fail(403, 'This action requires an order manager.');
  }
  if (
    user.role === 'delivery_manager' &&
    Object.keys(input).some(
      (k) =>
        ![
          'version',
          'deliveryStatus',
          'cashCollected',
          'reason',
          'note',
        ].includes(k),
    )
  )
    fail(403, 'Drivers can only update their delivery.');
  let status = input.status ?? order.status;
  if (input.deliveryStatus) {
    requireRole(user, ['owner', 'delivery_manager']);
    const map: Record<string, Status> = {
      'On the way': 'Out for Delivery',
      Delivered: 'Delivered',
      Failed: 'Failed Delivery',
      'Customer unavailable': 'Failed Delivery',
      Returned: 'Returned',
    };
    status = map[input.deliveryStatus] ?? status;
    if (
      !['Packed', 'Out for Delivery', 'Failed Delivery', 'Delivered'].includes(
        order.status,
      )
    )
      fail(409, 'This order is not ready for delivery.');
  }
  if (status !== order.status && !transitions[order.status].includes(status))
    fail(409, `Cannot move from ${order.status} to ${status}.`);
  if (
    ['Failed Delivery', 'Returned', 'Cancelled', 'Needs Attention'].includes(
      status,
    ) &&
    status !== order.status &&
    !input.reason?.trim() &&
    !input.note?.trim()
  )
    fail(400, 'Add a reason for this status change.');
  if (status === 'Out for Delivery' && !(input.driverId ?? order.driverId))
    fail(400, 'Assign a driver before sending the order.');
  if (input.employeeId !== undefined || input.driverId !== undefined)
    requireRole(user, ['owner', 'order_manager']);
  for (const [key, idValue] of [
    ['employeeId', input.employeeId],
    ['driverId', input.driverId],
  ] as const) {
    if (idValue) {
      const member = await one<User>(
        db,
        'SELECT id,role FROM users WHERE tenantId=? AND id=? AND active=1',
        t,
        idValue,
      );
      if (!member) fail(400, 'Select an active employee from this business.');
      if (
        key === 'driverId' &&
        !['owner', 'delivery_manager'].includes(member!.role)
      )
        fail(400, 'The selected employee does not have delivery permissions.');
    }
  }
  if (input.payment !== undefined)
    requireRole(user, ['owner', 'order_manager']);
  if (input.cashCollected !== undefined) {
    requireRole(user, ['owner', 'delivery_manager']);
    if (input.cashCollected > order.total)
      fail(400, 'Cash collected cannot exceed the order total.');
  }
  const result = await db.batch([
    stmt(
      db,
      'UPDATE orders SET status=?,payment=?,employeeId=?,driverId=?,deliveryStatus=?,cashCollected=?,reason=?,version=version+1,updatedAt=? WHERE tenantId=? AND id=? AND version=?',
      status,
      input.payment ?? order.payment,
      input.employeeId === undefined ? order.employeeId : input.employeeId,
      input.driverId === undefined ? order.driverId : input.driverId,
      input.deliveryStatus ?? order.deliveryStatus,
      input.cashCollected ?? order.cashCollected,
      input.reason ?? order.reason,
      now(),
      t,
      id,
      input.version,
    ),
    event(
      db,
      t,
      user.name,
      status !== order.status ? status : 'Order updated',
      id,
      input.note || input.reason || 'Order details updated',
      status !== order.status,
    ),
  ]);
  if (!result[0].meta.changes)
    fail(409, 'The order changed. Refresh it before trying again.');
  return orderDetail(env, t, id, user);
}
