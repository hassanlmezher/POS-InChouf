'use client';
import { useState } from 'react';
import { Plus, ArrowUpRight, LogOut, ShieldCheck } from 'lucide-react';
import {
  Brand,
  Loading,
  ErrorBox,
  Modal,
  Field,
  Choice,
  Toggle,
  Submit,
  StatusBadge,
  EmptyState,
} from '@/components/shared';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { api, useResource, message } from '@/lib/client';
import { type User, type Tenant, type Event, money } from '@/lib/types';
export default function Admin() {
  const me = useResource<{ user: User }>('me');
  const r = useResource<{
    tenants: (Tenant & { orderCount: number; userCount: number })[];
    events: Event[];
  }>(me.data?.user.role === 'super_admin' ? 'admin/tenants' : null);
  const [create, setCreate] = useState(false),
    [edit, setEdit] = useState<Tenant | null>(null),
    [reset, setReset] = useState<Tenant | null>(null);
  if (me.loading) return <Loading />;
  if (me.error || me.data?.user.role !== 'super_admin')
    return (
      <main className="section">
        <Brand />
        <ErrorBox error={me.error || 'Super Admin access is required.'} />
        <a className="button" href="/login">
          Sign in
        </a>
      </main>
    );
  const tenants = r.data?.tenants || [];
  const saved = () => {
    setCreate(false);
    setEdit(null);
    setReset(null);
    void r.refresh();
  };
  return (
    <div className="dashboard-shell">
      <header className="public-nav" style={{ maxWidth: 1400 }}>
        <Brand />
        <span className="badge violet">
          <ShieldCheck size={14} style={{ marginRight: 6 }} />
          Platform control
        </span>
        <button
          className="text-link"
          onClick={async () => {
            await api('logout', 'POST');
            location.href = '/login';
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div>
            <div className="eyebrow">INCHOUF SUPER ADMIN</div>
            <h1>Your platform, at a glance.</h1>
            <p>
              Manage businesses, access and manually activated subscriptions.
            </p>
          </div>
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={16} />
            Create business
          </button>
        </div>
        <div className="metric-grid admin-stats">
          {[
            ['Businesses', tenants.length],
            [
              'Active businesses',
              tenants.filter((t) => t.active && t.subscription !== 'suspended')
                .length,
            ],
            [
              'Suspended',
              tenants.filter((t) => !t.active || t.subscription === 'suspended')
                .length,
            ],
            [
              'Configured monthly value',
              money(
                tenants
                  .filter((t) => t.active && t.subscription === 'active')
                  .reduce((s, t) => s + t.price, 0),
              ),
            ],
          ].map(([a, b]) => (
            <div className="metric" key={a}>
              <span>{a}</span>
              <strong>{b}</strong>
              <small>
                {a === 'Configured monthly value'
                  ? 'Manual subscription value, not collected revenue'
                  : 'Platform records'}
              </small>
            </div>
          ))}
        </div>
        <ErrorBox error={r.error} retry={r.refresh} />
        <div className="panel">
          <div className="panel-head">
            <h3>Businesses</h3>
            <small>{tenants.length} total</small>
          </div>
          <Table className="op-table">
            <TableHeader>
              <TableRow>
                {[
                  'Business',
                  'Subscription',
                  'Team / orders',
                  'Health',
                  'Actions',
                ].map((x) => (
                  <TableHead key={x}>{x}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <strong>{t.name}</strong>
                    <small>{t.slug}.inchouf.com</small>
                    {t.slug === 'internal-demo' && (
                      <span className="badge">Internal testing only</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={t.subscription} />
                    <small>
                      {t.plan} · {money(t.price)} / month
                    </small>
                  </TableCell>
                  <TableCell>
                    {t.userCount} users<small>{t.orderCount} orders</small>
                  </TableCell>
                  <TableCell>
                    <span className={'badge ' + (t.active ? 'green' : 'red')}>
                      {t.active ? 'Enabled' : 'Disabled'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="inline-actions">
                      <button className="text-link" onClick={() => setEdit(t)}>
                        Manage
                      </button>
                      <button className="text-link" onClick={() => setReset(t)}>
                        Reset owner
                      </button>
                      <a
                        href={`/store/${t.slug}`}
                        aria-label={`Open ${t.name} storefront`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ArrowUpRight size={17} />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!tenants.length && (
            <EmptyState
              title="No businesses yet"
              description="Create a business when you are ready to onboard its owner."
            />
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Platform activity & errors</h3>
            <a
              href="/api/health"
              className="text-link"
              target="_blank"
              rel="noreferrer"
            >
              Check database health ↗
            </a>
          </div>
          <div className="panel-body activity-list">
            {r.data?.events.length ? (
              r.data.events.map((e) => (
                <div className="activity-item" key={e.id}>
                  <strong>{e.action}</strong>
                  <p>{e.detail}</p>
                  <small>
                    {e.actor} · {new Date(e.createdAt).toLocaleString()}
                  </small>
                </div>
              ))
            ) : (
              <p>No platform errors or administrative changes recorded.</p>
            )}
          </div>
        </div>
      </main>
      {create && (
        <CreateBusiness onClose={() => setCreate(false)} saved={saved} />
      )}{' '}
      {edit && (
        <Subscription
          tenant={edit}
          onClose={() => setEdit(null)}
          saved={saved}
        />
      )}{' '}
      {reset && (
        <ResetOwner
          tenant={reset}
          onClose={() => setReset(null)}
          saved={saved}
        />
      )}
    </div>
  );
}
function CreateBusiness({
  onClose,
  saved,
}: {
  onClose: () => void;
  saved: () => void;
}) {
  const [data, setData] = useState({
      name: '',
      slug: '',
      ownerName: '',
      email: '',
      password: '',
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      open
      title="Create a business"
      description="This creates a real business workspace and one owner. Leave this form unused while testing the internal demo."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('admin/tenants', 'POST', data);
            saved();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {Object.entries({
          name: 'Business name',
          slug: 'Store slug',
          ownerName: 'Owner name',
          email: 'Owner email',
          password: 'Initial owner password',
        }).map(([k, label]) => (
          <Field
            label={label}
            key={k}
            hint={
              k === 'slug'
                ? 'Lowercase letters, numbers and hyphens. Reserved subdomains are protected.'
                : undefined
            }
          >
            <input
              type={
                k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'
              }
              required
              minLength={k === 'password' ? 12 : 2}
              value={data[k as keyof typeof data]}
              onChange={(e) => setData({ ...data, [k]: e.target.value })}
            />
          </Field>
        ))}
        <ErrorBox error={error} />
        <Submit busy={busy}>Create business and owner</Submit>
      </form>
    </Modal>
  );
}
function Subscription({
  tenant: t,
  onClose,
  saved,
}: {
  tenant: Tenant;
  onClose: () => void;
  saved: () => void;
}) {
  const [active, setActive] = useState(Boolean(t.active)),
    [subscription, setSubscription] = useState(t.subscription),
    [plan, setPlan] = useState(t.plan),
    [price, setPrice] = useState(t.price / 100),
    [start, setStart] = useState(t.trialStart?.slice(0, 10) || ''),
    [end, setEnd] = useState(t.trialEnd?.slice(0, 10) || ''),
    [renewal, setRenewal] = useState(t.renewalDate?.slice(0, 10) || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const date = (x: string) => (x ? new Date(x).toISOString() : null);
  return (
    <Modal open title={`Manage ${t.name}`} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`admin/tenants/${t.id}`, 'PATCH', {
              active,
              subscription,
              plan,
              price: Math.round(price * 100),
              trialStart: date(start),
              trialEnd: date(end),
              renewalDate: date(renewal),
            });
            saved();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Toggle label="Business enabled" value={active} onChange={setActive} />
        <Choice
          label="Subscription status"
          value={subscription}
          onChange={setSubscription}
          options={['trial', 'active', 'past_due', 'suspended', 'cancelled']}
        />
        <div className="form-grid">
          <Field label="Plan">
            <input value={plan} onChange={(e) => setPlan(e.target.value)} />
          </Field>
          <Field label="Monthly price ($)">
            <input
              type="number"
              min="0"
              step=".01"
              value={price}
              onChange={(e) => setPrice(+e.target.value)}
            />
          </Field>
          <Field label="Trial start">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Trial end">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          <Field label="Renewal date">
            <input
              type="date"
              value={renewal}
              onChange={(e) => setRenewal(e.target.value)}
            />
          </Field>
        </div>
        <ErrorBox error={error} />
        <Submit busy={busy} />
      </form>
    </Modal>
  );
}
function ResetOwner({
  tenant,
  onClose,
  saved,
}: {
  tenant: Tenant;
  onClose: () => void;
  saved: () => void;
}) {
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      open
      title="Reset owner access"
      description={`All owner sessions for ${tenant.name} will be revoked. Share the new password privately.`}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`admin/tenants/${tenant.id}/reset`, 'POST', { password });
            saved();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="New owner password">
          <input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorBox error={error} />
        <Submit busy={busy}>Reset access</Submit>
      </form>
    </Modal>
  );
}
