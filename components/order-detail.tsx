'use client';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Field, Choice, ErrorBox, StatusBadge, Loading } from './shared';
import { api, useResource, message } from '@/lib/client';
import { money, type Detail, type User } from '@/lib/types';
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
    team = useResource<User[]>('team');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [tracking, setTracking] = useState(''),
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
  const save = async (data: Record<string, unknown>) => {
    if (!o) return;
    setBusy(true);
    setError('');
    try {
      await api(`orders/${id}`, 'PATCH', {
        ...data,
        version: o.version,
      });
      await r.refresh();
      onSaved();
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
                      <h3>Order configuration</h3>
                    </div>
                    <div className="panel-body form-stack">
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
