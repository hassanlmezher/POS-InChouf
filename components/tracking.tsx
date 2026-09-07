'use client';
import {
  CheckCircle2,
  Package,
  Truck,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useResource } from '@/lib/client';
import { ActionButton, Loading, ErrorBox, StatusBadge } from './shared';
import { useState } from 'react';
import { type Order, type Item, type Event, money } from '@/lib/types';
export default function Tracking({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const path = `store/${slug}/track/${token}`;
  const r = useResource<{
    tenant: { name: string };
    order: Order;
    items: Item[];
    events: Event[];
  }>(path);
  if (r.loading) return <Loading />;
  if (r.error || !r.data)
    return (
      <main className="section">
        <h1>Tracking unavailable</h1>
        <ErrorBox error={r.error} />
        <a href={`/store/${slug}`} className="button secondary">
          Back to store
        </a>
      </main>
    );
  const { order: o, tenant, items, events } = r.data;
  const flow = [
    'New',
    'Confirmed',
    'Picking',
    'Packed',
    'Out for Delivery',
    'Delivered',
  ];
  const index = flow.indexOf(o.status);
  return (
    <main className="tracking-page">
      <a className="back-link" href={`/store/${slug}`}>
        <ArrowLeft size={16} />
        {tenant.name}
      </a>
      <section className="tracking-hero">
        <div className="tracking-icon">
          {o.status === 'Delivered' ? (
            <CheckCircle2 size={30} />
          ) : o.status === 'Out for Delivery' ? (
            <Truck size={30} />
          ) : (
            <Package size={30} />
          )}
        </div>
        <span className="eyebrow">YOUR ORDER, EVERY STEP OF THE WAY</span>
        <h1>
          {o.status === 'Delivered'
            ? 'A good delivery.'
            : o.status === 'Out for Delivery'
              ? 'On the way to you.'
              : index < 0
                ? 'Your order needs a little attention.'
                : 'Good things are in motion.'}
        </h1>
        <p>{o.reference}</p>
        <div
          className="inline-actions"
          style={{ justifyContent: 'center', marginTop: 18 }}
        >
          <StatusBadge value={o.status} />
          <StatusBadge value={o.payment} />
        </div>
      </section>
      <div className="tracking-steps">
        {flow.map((s, i) => (
          <div
            className={
              i < index ? 'complete' : i === index ? 'current' : ''
            }
            aria-current={i === index ? 'step' : undefined}
            key={s}
          >
            <span>{i < index ? <CheckCircle2 size={18} /> : i + 1}</span>
            <p>{s}</p>
          </div>
        ))}
      </div>
      <ActionButton
        className="text-link progress-action"
        busy={refreshing}
        busyLabel="Refreshing…"
        onClick={async () => {
          setRefreshing(true);
          try {
            await r.refresh();
          } finally {
            setRefreshing(false);
          }
        }}
      >
        Refresh order status
      </ActionButton>
      <div className="panel">
        <div className="panel-head">
          <h3>Your order</h3>
          <strong>{money(o.total)}</strong>
        </div>
        <div className="panel-body">
          {items.map((i, n) => (
            <div className="order-total" key={n}>
              <span>
                {i.quantity} × {i.name}
                {i.variant && ` · ${i.variant}`}
              </span>
              <span>{money(i.price * i.quantity)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <h3>Order updates</h3>
        </div>
        <div className="panel-body activity-list">
          {events.map((e, i) => (
            <div className="activity-item" key={i}>
              <strong>{e.action}</strong>
              <small>{new Date(e.createdAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
      <p className="private-note">
        <ShieldCheck size={16} />
        This link is private. Anyone you share it with can view this order&apos;s
        progress.
      </p>
      <footer className="store-footer">
        <a href="/">Powered by InChouf OrderPilot</a>
      </footer>
    </main>
  );
}
