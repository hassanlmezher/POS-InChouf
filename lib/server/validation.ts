import { z } from 'zod';
import { reserved } from './security';
export const id = z.string().min(1).max(100);
const text = z.string().trim().max(2000);
const cents = z.number().int().min(0).max(100000000);
export const loginInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: z.string().min(1).max(256),
  })
  .strict();
export const staffInput = z
  .object({
    email: z.email().transform((x) => x.toLowerCase()),
    name: z.string().trim().min(2).max(100),
    role: z.enum(['order_manager', 'picker', 'delivery_manager', 'assistant']),
    password: z.string().min(12).max(128),
  })
  .strict();
export const tenantInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,48}[a-z0-9]$/)
      .refine((x) => !reserved.includes(x)),
    ownerName: z.string().trim().min(2).max(100),
    billingPhone: z.string().trim().min(5).max(40),
    email: z.email().transform((x) => x.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const productInput = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: text,
    category: z.string().trim().min(1).max(80),
    sku: z.string().trim().min(1).max(80).optional(),
    price: cents,
    stock: z.number().int().min(0).max(1000000),
    lowStock: z.number().int().min(0).max(1000000),
    active: z.boolean(),
    image: z
      .string()
      .max(100)
      .refine(
        (x) =>
          !x ||
          /^\/assets\/[a-z0-9.-]+$/.test(x) ||
          /^\/api\/images\/[a-f0-9-]+$/.test(x),
      ),
    variants: z
      .array(
        z
          .object({
            name: z.string().min(1).max(100),
            price: cents,
            sku: z.string().max(80),
          })
          .strict(),
      )
      .max(40)
      .refine((v) => new Set(v.map((x) => x.name)).size === v.length),
    customFields: z
      .array(
        z
          .object({
            name: z
              .string()
              .min(1)
              .max(80)
              .refine(
                (x) => !['__proto__', 'constructor', 'prototype'].includes(x),
              ),
            required: z.boolean(),
            type: z.literal('text'),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
export const zoneInput = z
  .object({
    name: z.string().min(2).max(80),
    fee: cents,
    freeAbove: cents.nullable(),
    minimum: cents,
    active: z.boolean(),
    notes: text,
  })
  .strict();
export const checkoutInput = z
  .object({
    customer: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(5).max(40),
    email: z.union([z.email(), z.literal('')]),
    address: z.string().trim().min(8).max(1000),
    zoneId: id,
    notes: text,
    paymentMethod: z.string().min(1).max(80),
    discountPercent: z.number().int().min(0).max(100).default(0),
    idempotency: z.uuid(),
    items: z
      .array(
        z
          .object({
            productId: id,
            quantity: z.number().int().min(1).max(100),
            variant: z.string().max(100),
            custom: z.record(z.string().max(80), z.string().max(1000)),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const updateOrderInput = z
  .object({
    version: z.number().int().min(0),
    status: z
      .enum([
        'New',
        'Confirmed',
        'Picking',
        'Packed',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
        'Returned',
        'Failed Delivery',
        'Needs Attention',
      ])
      .optional(),
    payment: z.enum(['Unpaid', 'Paid', 'Refunded']).optional(),
    employeeId: id.nullable().optional(),
    driverId: id.nullable().optional(),
    deliveryMethod: z.enum(['internal_driver', 'external_courier']).optional(),
    deliveryProvider: z.string().trim().max(120).optional(),
    deliveryStatus: z
      .enum([
        'Pending',
        'Picked up',
        'On the way',
        'Delivered',
        'Failed',
        'Customer unavailable',
        'Returned',
      ])
      .optional(),
    cashCollected: cents.optional(),
    reason: text.optional(),
    note: text.optional(),
  })
  .strict();
export const settlementInput = z
  .object({
    method: z.enum(['internal_driver', 'external_courier']),
    driverId: id.nullable().optional(),
    provider: z.string().trim().max(120).optional(),
    periodStart: z.iso.datetime().nullable().optional(),
    periodEnd: z.iso.datetime().nullable().optional(),
    actual: cents,
  })
  .strict();
export const settingsInput = z
  .object({
    tagline: z.string().max(150),
    description: text,
    contactEmail: z.union([z.email(), z.literal('')]),
    contactPhone: z.string().max(50),
    address: text,
    paymentOptions: z.array(z.string().min(1).max(80)).min(1).max(5),
    categories: z.array(z.string().min(1).max(80)).max(40),
    deliveryProviders: z.array(z.string().min(1).max(120)).max(40),
    currency: z.literal('USD'),
    branding: z
      .object({ logoId: z.union([id, z.null()]) })
      .strict()
      .optional(),
  })
  .strict();
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const value = await req.text();
  if (value.length > 100000) throw new Error('BODY_TOO_LARGE');
  return schema.parse(JSON.parse(value));
}
export { z };
