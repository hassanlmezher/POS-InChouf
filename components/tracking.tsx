'use client';
import { useState } from 'react';
import {
  CheckCircle2,
  Package,
  Truck,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useResource, api, uploadFile, message } from '@/lib/client';
import { Loading, ErrorBox, Field, StatusBadge } from './shared';
import {
  type Order,
  type Item,
  type Proof,
  type Event,
  money,
} from '@/lib/types';
export default function Tracking({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const path = `store/${slug}/track/${token}`;
  const r = useResource<{
    tenant: { name: string };
    order: Order;
    items: Item[];
    events: Event[];
    proofs: Proof[];
  }>(path);
  const [error, setError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false),
    [uploaded, setUploaded] = useState('');
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
  const { order: o, tenant, items, events, proofs } = r.data;
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
          <div className={i <= index ? 'complete' : ''} key={s}>
            <span>{i < index ? <CheckCircle2 size={18} /> : i + 1}</span>
            <p>{s}</p>
          </div>
        ))}
      </div>
      <button className="text-link" onClick={r.refresh}>
        Refresh order status
      </button>
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
      {proofs.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Your custom-product proofs</h3>
          </div>
          <div className="panel-body">
            {proofs.map((p, i) => (
              <article className="proof-card" key={p.id}>
                <div className="section-heading">
                  <h3>Version {p.version}</h3>
                  <StatusBadge value={p.status} />
                </div>
                <p>{p.note}</p>{p.contentType?.startsWith("image/")&&<img className="proof-preview" src={`/api/${path}/files/${p.fileId}`} alt={`Proof version ${p.version}`} />}
                <a
                  className="button secondary"
                  href={`/api/${path}/files/${p.fileId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download and review proof
                </a>
                {p.feedback && <p>{p.feedback}</p>}
                {i === 0 && p.status === 'Pending' && (
                  <>
                    <Field label="Feedback for the shop">
                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                      />
                    </Field>
                    <div className="inline-actions">
                      {['Approved', 'Changes requested'].map((decision) => (
                        <button
                          key={decision}
                          disabled={
                            busy ||
                            (decision === 'Changes requested' &&
                              !feedback.trim())
                          }
                          className={
                            'button ' +
                            (decision === 'Approved' ? '' : 'secondary')
                          }
                          onClick={async () => {
                            setBusy(true);
                            setError('');
                            try {
                              await api(`${path}/proofs/${p.id}`, 'POST', {
                                decision,
                                feedback,
                              });
                              await r.refresh();
                            } catch (e) {
                              setError(message(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {decision === 'Approved'
                            ? 'Approve & lock this version'
                            : 'Request changes'}
                        </button>
                      ))}
                    </div>
                    <small>
                      Approval locks this version for preparation. Review the
                      file before approving.
                    </small>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panel-head">
          <h3>Share artwork or a reference</h3>
        </div>
        <div className="panel-body">
          <Field
            label="Upload a file"
            hint="PNG, JPEG or PDF. Maximum 5 MB. Visible only to your shop and holders of this private link."
          >
            <input
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              disabled={
                busy ||
                ['Cancelled', 'Returned', 'Delivered'].includes(o.status)
              }
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setError('');
                try {
                  await uploadFile(`${path}/files`, f);
                  setUploaded(`${f.name} was shared with the shop.`);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Field>
          {uploaded && (
            <div className="success-box" role="status">
              {uploaded}
            </div>
          )}
        </div>
      </div>
      <ErrorBox error={error} />
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
        This link is private. Anyone you share it with can view and manage
        customer proof approvals.
      </p>
      <footer className="store-footer">
        <a href="/">Powered by InChouf OrderPilot</a>
      </footer>
    </main>
  );
}
