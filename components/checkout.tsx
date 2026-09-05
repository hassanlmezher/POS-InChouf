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
  quantity: number;
  variant: string;
  custom: Record<string, string>;
}
export default function Checkout({
  products,
  zones,
  settings,
  lines,
  endpoint,
  onComplete,
}: {
  products: Product[];
  zones: Zone[];
  settings: Settings;
  lines: CartLine[];
  endpoint: string;
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
    [payment, setPayment] = useState(
      settings.paymentOptions[0] || 'Cash on delivery',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [idempotency] = useState(() => crypto.randomUUID());
  const zone = zones.find((z) => z.id === zoneId);
  const subtotal = lines.reduce((sum, line) => {
    const p = products.find((p) => p.id === line.productId);
    if (!p) return sum;
    const v = (JSON.parse(p.variants) as Variant[]).find(
      (v) => v.name === line.variant,
    );
    return sum + (v?.price ?? p.price) * line.quantity;
  }, 0);
  const fee = zone
    ? zone.freeAbove !== null && subtotal >= zone.freeAbove
      ? 0
      : zone.fee
    : 0;
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
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
      <Choice
        label="Delivery zone"
        value={zoneId}
        onChange={setZone}
        options={zones.map((z) => ({
          value: z.id,
          label: `${z.name} · ${money(z.fee)}`,
        }))}
      />
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
      <div>
        <div className="order-total">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="order-total">
          <span>Delivery</span>
          <span>{money(fee)}</span>
        </div>
        <div className="order-total final">
          <span>Total</span>
          <span>{money(subtotal + fee)}</span>
        </div>
      </div>
      <ErrorBox error={error} />
      <Submit busy={busy || !zone || !lines.length}>
        Place order · {money(subtotal + fee)}
      </Submit>
      <small>
        Your details are shared with this shop to prepare and deliver your
        order. Save your private tracking link after checkout.
      </small>
    </form>
  );
}
