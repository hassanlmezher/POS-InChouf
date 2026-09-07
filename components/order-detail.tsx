'use client';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Field,
  Choice,
  ErrorBox,
  StatusBadge,
  Loading,
  Submit,
} from './shared';
import { api, useResource, uploadFile, message } from '@/lib/client';
import { money, transitions, type Detail, type User } from '@/lib/types';
export default function OrderDetail({
  id,
  user,
  onClose,
  onSaved,
}: {
  id: string;
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const r = useResource<Detail>(`orders/${id}`, { intervalMs: 10000 }),
    team = useResource<User[]>('team'),
    files = useResource<{ id: string; name: string }[]>(`orders/${id}/files`);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [tracking, setTracking] = useState(''),
    [proofFile, setProofFile] = useState(''),
    [proofNote, setProofNote] = useState(''),
    [cash, setCash] = useState(''),
    [deliveryMethod, setDeliveryMethod] = useState<
      'internal_driver' | 'external_courier'
    >('internal_driver'),
    [deliveryProvider, setDeliveryProvider] = useState('');
  const o = r.data?.order;
  const manager = ['owner', 'order_manager'].includes(user.role);
  const orderId = o?.id;
  const orderDeliveryMethod = o?.deliveryMethod;
  const orderDeliveryProvider = o?.deliveryProvider;
  useEffect(() => {
    if (!orderId) return;
    setDeliveryMethod(orderDeliveryMethod || 'internal_driver');
    setDeliveryProvider(orderDeliveryProvider || '');
  }, [orderId, orderDeliveryMethod, orderDeliveryProvider]);
  const normalStatus: Record<string, { label: string; status: string }> = {
    New: { label: 'Confirm order', status: 'Confirmed' },
    Confirmed: { label: 'Start picking', status: 'Picking' },
    Picking: { label: 'Mark as packed', status: 'Packed' },
    Packed: { label: 'Hand off for delivery', status: 'Out for Delivery' },
    'Out for Delivery': { label: 'Mark delivered', status: 'Delivered' },
  };
  const normalDelivery: Record<string, string> = {
    Pending: 'Picked up',
    'Picked up': 'On the way',
    'On the way': 'Delivered',
  };
  const save = async (data: Record<string, unknown>) => {
    if (!o) return;
    setBusy(true);
    setError('');
    try {
      await api(`orders/${id}`, 'PATCH', { ...data, version: o.version, note });
      await r.refresh();
      onSaved();
      setNote('');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="details-sheet">
        <div className="sheet-inner">
          <SheetHeader>
            <SheetTitle>{o?.reference || 'Order details'}</SheetTitle>
            <SheetDescription>
              {o ? new Date(o.createdAt).toLocaleString() : 'Loading order'}
            </SheetDescription>
          </SheetHeader>
          {r.loading ? (
            <Loading />
          ) : (
            <>
              <ErrorBox error={r.error} retry={r.refresh} />
              {o && r.data && (
                <>
                  <div className="inline-actions" style={{ margin: '22px 0' }}>
                    <StatusBadge value={o.status} />
                    <StatusBadge value={o.payment} />
                  </div>
                  <div className="detail-grid">
                    <div>
                      <small>Customer</small>
                      <strong>{o.customer}</strong>
                      <p>{o.phone}</p>
                      <p>{o.email}</p>
                    </div>
                    <div>
                      <small>Delivery address</small>
                      <p>{o.address}</p>
                    </div>
                  </div>
                  {o.notes && (
                    <div className="note-block" style={{ marginTop: 20 }}>
                      {o.notes}
                    </div>
                  )}
                  <div className="panel">
                    <div className="panel-head">
                      <h3>Items to prepare</h3>
                      <span className="badge">{r.data.items.length} items</span>
                    </div>
                    <div className="panel-body">
                      {r.data.items.map((i) => (
                        <div key={i.id} style={{ padding: '12px 0' }}>
                          <div className="section-heading">
                            <strong>
                              {i.quantity} × {i.name}
                            </strong>
                            <span>{money(i.quantity * i.price)}</span>
                          </div>
                          <small>{i.variant}</small>
                          {Object.entries(
                            JSON.parse(i.custom) as Record<string, string>,
                          ).map(([k, v]) => (
                            <p key={k} style={{ fontSize: 13 }}>
                              {k}: {v}
                            </p>
                          ))}
                        </div>
                      ))}
                      <div className="order-total">
                        <span>Subtotal</span>
                        <span>{money(o.subtotal)}</span>
                      </div>
                      <div className="order-total">
                        <span>Delivery fee</span>
                        <span>{money(o.deliveryFee)}</span>
                      </div>
                      <div className="order-total final">
                        <span>Total</span>
                        <span>{money(o.total)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-head">
                      <h3>Next action</h3>
                    </div>
                    <div className="panel-body form-stack">
                      <Field
                        label="Note or reason"
                        hint="Required for cancellation, returns and exceptions."
                      >
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add helpful context for the team"
                        />
                      </Field>
                      {manager && (
                        <div className="note-block form-stack">
                          <Choice
                            label="Delivery method"
                            value={deliveryMethod}
                            onChange={(v) =>
                              setDeliveryMethod(
                                v as 'internal_driver' | 'external_courier',
                              )
                            }
                            options={[
                              {
                                value: 'internal_driver',
                                label: 'Internal driver',
                              },
                              {
                                value: 'external_courier',
                                label: 'External courier',
                              },
                            ]}
                          />
                          {deliveryMethod === 'external_courier' && (
                            <Field label="External courier">
                              <input
                                value={deliveryProvider}
                                maxLength={120}
                                placeholder="Courier or delivery company"
                                onChange={(e) =>
                                  setDeliveryProvider(e.target.value)
                                }
                              />
                            </Field>
                          )}
                          <button
                            className="button secondary small"
                            disabled={busy}
                            onClick={() =>
                              save({
                                deliveryMethod,
                                deliveryProvider:
                                  deliveryMethod === 'external_courier'
                                    ? deliveryProvider.trim()
                                    : '',
                              })
                            }
                          >
                            Save delivery method
                          </button>
                        </div>
                      )}
                      {user.role !== 'delivery_manager' &&
                        normalStatus[o.status] &&
                        !(
                          user.role === 'picker' &&
                          !['Confirmed', 'Picking'].includes(o.status)
                        ) && (
                          <>
                            <button
                              className="button"
                              disabled={
                                busy ||
                                (o.status === 'Packed' &&
                                  deliveryMethod === 'internal_driver' &&
                                  !o.driverId)
                              }
                              onClick={() =>
                                save({
                                  status: normalStatus[o.status].status,
                                  deliveryMethod:
                                    o.status === 'Packed'
                                      ? deliveryMethod
                                      : undefined,
                                  deliveryProvider:
                                    o.status === 'Packed' &&
                                    deliveryMethod === 'external_courier'
                                      ? deliveryProvider.trim()
                                      : undefined,
                                  reason: note,
                                })
                              }
                            >
                              {normalStatus[o.status].label}
                            </button>
                            {o.status === 'Packed' &&
                              deliveryMethod === 'internal_driver' &&
                              !o.driverId && (
                                <small className="danger-text">
                                  Assign a driver or choose external courier
                                  before handoff.
                                </small>
                              )}
                          </>
                        )}
                      {user.role === 'delivery_manager' &&
                        normalDelivery[o.deliveryStatus] && (
                          <button
                            className="button"
                            disabled={busy}
                            onClick={() =>
                              save({
                                deliveryStatus:
                                  normalDelivery[o.deliveryStatus],
                                reason: note,
                              })
                            }
                          >
                            {normalDelivery[o.deliveryStatus] === 'Picked up'
                              ? 'Mark picked up'
                              : normalDelivery[o.deliveryStatus] === 'On the way'
                                ? 'Start delivery'
                                : 'Mark delivered'}
                          </button>
                        )}
                      <div className="inline-actions">
                        {user.role !== 'delivery_manager' &&
                          transitions[o.status]
                            .filter(
                              (s) =>
                                s !== normalStatus[o.status]?.status &&
                                (user.role !== 'picker' ||
                                  [
                                    'Picking',
                                    'Packed',
                                    'Needs Attention',
                                  ].includes(s)),
                            )
                            .map((s) => (
                              <button
                                key={s}
                                className={
                                  'button small ' +
                                  ([
                                    'Cancelled',
                                    'Returned',
                                    'Needs Attention',
                                    'Failed Delivery',
                                  ].includes(s)
                                    ? 'secondary'
                                    : '')
                                }
                                disabled={busy}
                                onClick={() =>
                                  save(user.role === 'picker' ? {status:s} : { status: s, reason: note })
                                }
                              >
                                {s}
                              </button>
                            ))}
                        <button
                          className="button secondary small"
                          disabled={busy || !note.trim()}
                          onClick={() => save({})}
                        >
                          Save note
                        </button>
                      </div>
                      {manager && (
                        <>
                          <Choice
                            label="Assigned employee"
                            value={o.employeeId || 'none'}
                            onChange={(v) =>
                              save({ employeeId: v === 'none' ? null : v })
                            }
                            options={[
                              { value: 'none', label: 'Unassigned' },
                              ...(team.data || []).map((u) => ({
                                value: u.id,
                                label: u.name,
                              })),
                            ]}
                          />
                          <Choice
                            label="Assigned driver"
                            value={o.driverId || 'none'}
                            onChange={(v) =>
                              save({ driverId: v === 'none' ? null : v })
                            }
                            options={[
                              { value: 'none', label: 'Unassigned' },
                              ...(team.data || [])
                                .filter((u) =>
                                  ['owner', 'delivery_manager'].includes(
                                    u.role,
                                  ),
                                )
                                .map((u) => ({ value: u.id, label: u.name })),
                            ]}
                          />
                          <Choice
                            label="Payment status"
                            value={o.payment}
                            onChange={(v) => save({ payment: v })}
                            options={['Unpaid', 'Paid', 'Refunded']}
                          />
                        </>
                      )}
                      {['owner', 'delivery_manager'].includes(user.role) && (
                        <>
                          <div className="inline-actions">
                            {[
                              'Failed',
                              'Customer unavailable',
                              'Returned',
                            ].map((v) => (
                              <button
                                key={v}
                                className="button secondary small"
                                disabled={busy || !note.trim()}
                                onClick={() =>
                                  save({ deliveryStatus: v, reason: note })
                                }
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                          <Field
                            label={`Cash collected · recorded ${money(o.cashCollected)}`}
                          >
                            <input
                              type="number"
                              min="0"
                              max={o.total / 100}
                              step=".01"
                              placeholder="Amount in USD"
                              value={cash}
                              onChange={(e) => setCash(e.target.value)}
                            />
                          </Field>
                          <button
                            className="button secondary"
                            disabled={busy || cash === ''}
                            onClick={() =>
                              save({
                                cashCollected: Math.round(Number(cash) * 100),
                              })
                            }
                          >
                            Record cash collected
                          </button>
                        </>
                      )}
                      <ErrorBox error={error} />
                    </div>
                  </div>
                  {manager && (
                    <div className="panel">
                      <div className="panel-head">
                        <h3>Private customer tracking</h3>
                      </div>
                      <div className="panel-body form-stack">
                        <p>
                          <small>
                            Creating a new link immediately revokes the previous
                            link.
                          </small>
                        </p>
                        <div className="inline-actions">
                          <button
                            className="button secondary small"
                            onClick={async () => {
                              try {
                                const d = await api<{ trackingUrl: string }>(
                                  `orders/${id}/tracking`,
                                  'POST',
                                  { revoke: false },
                                );
                                setTracking(location.origin + d.trackingUrl);
                              } catch (e) {
                                setError(message(e));
                              }
                            }}
                          >
                            Create new link
                          </button>
                          <button
                            className="button secondary small"
                            onClick={async () => {
                              try {
                                await api(`orders/${id}/tracking`, 'POST', {
                                  revoke: true,
                                });
                                setTracking('Link revoked');
                              } catch (e) {
                                setError(message(e));
                              }
                            }}
                          >
                            Revoke link
                          </button>
                        </div>
                        {tracking && (
                          <div
                            className="success-box"
                            style={{ overflowWrap: 'anywhere' }}
                          >
                            {tracking}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="panel">
                    <div className="panel-head">
                      <h3>Custom files & proofs</h3>
                    </div>
                    <div className="panel-body">
                      {files.data?.map((f) => (
                        <div key={f.id}>
                          <a
                            className="text-link"
                            href={`/api/files/${f.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {f.name} ↓
                          </a>
                        </div>
                      ))}
                      {r.data.proofs.map((p) => (
                        <div className="proof-card" key={p.id}>
                          <div className="section-heading">
                            <strong>Version {p.version}</strong>
                            <StatusBadge value={p.status} />
                          </div>
                          <p>{p.note}</p>{p.contentType?.startsWith("image/")&&<img className="proof-preview" src={`/api/files/${p.fileId}`} alt={`Proof version ${p.version}`} />}
                          <a
                            className="text-link"
                            href={`/api/files/${p.fileId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download proof
                          </a>
                          {p.feedback && <p>{p.feedback}</p>}
                        </div>
                      ))}
                      {manager && (
                        <form
                          className="form-stack"
                          style={{ marginTop: 20 }}
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setBusy(true);
                            try {
                              await api(`orders/${id}/proofs`, 'POST', {
                                fileId: proofFile,
                                note: proofNote,
                              });
                              setProofFile('');
                              setProofNote('');
                              await r.refresh();
                              onSaved();
                            } catch (e) {
                              setError(message(e));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <Field label="Upload proof or reference file">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,application/pdf"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setBusy(true);
                                try {
                                  const f = await uploadFile(
                                    `orders/${id}/files`,
                                    file,
                                  );
                                  setProofFile(f.id);
                                  await files.refresh();
                                } catch (e) {
                                  setError(message(e));
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            />
                          </Field>
                          <Choice
                            label="Proof file"
                            value={proofFile || 'none'}
                            onChange={(v) =>
                              setProofFile(v === 'none' ? '' : v)
                            }
                            options={[
                              { value: 'none', label: 'Select a file' },
                              ...(files.data || []).map((f) => ({
                                value: f.id,
                                label: f.name,
                              })),
                            ]}
                          />
                          <Field label="Message for customer">
                            <textarea
                              value={proofNote}
                              onChange={(e) => setProofNote(e.target.value)}
                            />
                          </Field>
                          <Submit busy={busy || !proofFile}>
                            Share new proof version
                          </Submit>
                        </form>
                      )}
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-head">
                      <h3>Activity timeline</h3>
                    </div>
                    <div className="panel-body activity-list">
                      {r.data.events.map((e) => (
                        <div className="activity-item" key={e.id}>
                          <strong>{e.action}</strong>
                          <p>{e.detail}</p>
                          <small>
                            {e.actor} · {new Date(e.createdAt).toLocaleString()}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
