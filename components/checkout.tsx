'use client';
import { useState } from 'react';
import { Field, Choice, ErrorBox, Submit } from './shared';
import { api, message } from '@/lib/client';
import {
  money,
  type Product,
  type Zone,
  type Variant,
  type Settings,
} from '@/lib/types';
export interface CartLine {
  productId: string;
  quantity: number | '';
  variant: string;
  custom: Record<string, string>;
}

export function isValidQuantity(quantity: CartLine['quantity']): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isFinite(quantity) &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 100
  );
}
export default function Checkout({
  products,
  zones,
  settings,
  lines,
  endpoint,
  allowDiscount = false,
  onComplete,
}: {
  products: Product[];
  zones: Zone[];
  settings: Settings;
  lines: CartLine[];
  endpoint: string;
  allowDiscount?: boolean;
  onComplete: (d: {
    trackingUrl: string;
    reference: string;
    total: number;
  }) => void;
}) {
  const [customer, setCustomer] = useState(''),
    [phone, setPhone] = useState(''),
    [email, setEmail] = useState(''),
    [address, setAddress] = useState(''),
    [zoneId, setZone] = useState(zones[0]?.id || ''),
    [notes, setNotes] = useState(''),
    [discount, setDiscount] = useState(''),
    [payment, setPayment] = useState(
      settings.paymentOptions[0] || 'Cash on delivery',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [idempotency] = useState(() => crypto.randomUUID());
  const zone = zones.find((z) => z.id === zoneId);
  const unavailable = !zones.length;
  const quantityIssue = lines.some((line) => !isValidQuantity(line.quantity));
  const stockIssue = lines.find((line) => {
    if (!isValidQuantity(line.quantity)) return false;
    const p = products.find((p) => p.id === line.productId);
    return !p || p.stock < line.quantity || p.stock <= 0;
  });
  const subtotal = lines.reduce((sum, line) => {
    const p = products.find((p) => p.id === line.productId);
    if (!p) return sum;
    const quantity = isValidQuantity(line.quantity) ? line.quantity : 0;
    const v = (JSON.parse(p.variants) as Variant[]).find(
      (v) => v.name === line.variant,
    );
    return sum + (v?.price ?? p.price) * quantity;
  }, 0);
  const discountNumber = discount.trim() === '' ? 0 : Number(discount);
  const discountIssue =
    allowDiscount &&
    (!Number.isFinite(discountNumber) ||
      !Number.isInteger(discountNumber) ||
      discountNumber < 0 ||
      discountNumber > 100);
  const discountPercent = allowDiscount && !discountIssue ? discountNumber : 0;
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const fee = zone
    ? zone.freeAbove !== null && discountedSubtotal >= zone.freeAbove
      ? 0
      : zone.fee
    : 0;
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (unavailable) {
          setError(
            'Delivery is unavailable because this business has not configured a delivery zone.',
          );
          return;
        }
        if (!lines.length) {
          setError('Add at least one item before checkout.');
          return;
        }
        if (quantityIssue) {
          setError('Enter a whole-number quantity of at least 1 for every item.');
          return;
        }
        if (stockIssue) {
          setError('Stock changed. Please review your bag before checkout.');
          return;
        }
        if (discountIssue) {
          setError('Enter a whole-number discount from 0 to 100.');
          return;
        }
        setBusy(true);
        setError('');
        try {
          const r = await api<{
            trackingUrl: string;
            reference: string;
            total: number;
          }>(endpoint, 'POST', {
            customer,
            phone,
            email,
            address,
            zoneId,
            notes,
            paymentMethod: payment,
            discountPercent,
            idempotency,
            items: lines,
          });
          onComplete(r);
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Full name">
          <input
            autoComplete="name"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            minLength={2}
            required
          />
        </Field>
        <Field label="Phone number">
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            minLength={5}
            required
          />
        </Field>
      </div>
      <Field label="Email (optional)">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field
        label="Delivery address"
        hint="Street, building, floor and a nearby landmark."
      >
        <textarea
          autoComplete="street-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      {unavailable ? (
        <div className="error-box" role="alert">
          Delivery is unavailable because this business has not configured a
          delivery zone yet.
        </div>
      ) : (
        <Choice
          label="Delivery zone"
          value={zoneId}
          onChange={setZone}
          options={zones.map((z) => ({
            value: z.id,
            label: `${z.name} · ${money(z.fee)}`,
          }))}
        />
      )}
      {zone && (
        <p>
          <small>
            {zone.notes}
            {zone.minimum > 0 && ` · Minimum order ${money(zone.minimum)}`}
            {zone.freeAbove !== null &&
              ` · Free delivery from ${money(zone.freeAbove)}`}
          </small>
        </p>
      )}
      <Choice
        label="Payment method"
        value={payment}
        onChange={setPayment}
        options={settings.paymentOptions}
      />
      <Field label="Order notes (optional)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {allowDiscount && (
        <Field label="Discount (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="0"
            aria-invalid={discountIssue}
          />
          {discountIssue && (
            <small className="danger-text">
              Enter a whole-number discount from 0 to 100.
            </small>
          )}
        </Field>
      )}
      <div>
        <div className="order-total">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="order-total discount">
            <span>Discount ({discountPercent}%)</span>
            <span>-{money(discountAmount)}</span>
          </div>
        )}
        <div className="order-total">
          <span>Delivery</span>
          <span>{money(fee)}</span>
        </div>
        <div className="order-total final">
          <span>Total</span>
          <span>{money(discountedSubtotal + fee)}</span>
        </div>
      </div>
      <ErrorBox error={error} />
      <Submit
        busy={busy}
        busyLabel="Placing order…"
        disabled={!zone || !lines.length || !!stockIssue || discountIssue}
      >
        Place order · {money(discountedSubtotal + fee)}
      </Submit>
      <small>
        Your details are shared with this shop to prepare and deliver your
        order. Save your private tracking link after checkout.
      </small>
    </form>
  );
}
