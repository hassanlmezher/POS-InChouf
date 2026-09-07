'use client';
import { useState } from 'react';
import {
  Modal,
  Field,
  Choice,
  Toggle,
  ErrorBox,
  ActionButton,
  Submit,
  StatusBadge,
  EmptyState,
  Loading,
} from './shared';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { api, uploadFile, useResource, message } from '@/lib/client';
import {
  type Zone,
  type User,
  type Tenant,
  type Settings,
  type Role,
  roleLabels,
  money,
  settingsOf,
} from '@/lib/types';
export function Zones() {
  const r = useResource<Zone[]>('zones');
  const [edit, setEdit] = useState<Zone | null | undefined>(undefined);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Delivery zones</h1>
          <p>Your coverage, your fees, your delivery promise.</p>
        </div>
        <button className="button" onClick={() => setEdit(null)}>
          Add delivery zone
        </button>
      </div>
      <ErrorBox error={r.error} />
      {r.loading ? (
        <Loading />
      ) : !r.data?.length ? (
        <EmptyState
          title="Set your delivery area"
          description="Add a zone so customers can place orders."
        />
      ) : (
        <div className="panel">
          <Table className="op-table">
            <TableHeader>
              <TableRow>
                {[
                  'Zone',
                  'Fee',
                  'Minimum order',
                  'Free delivery',
                  'Availability',
                  '',
                ].map((x) => (
                  <TableHead key={x}>{x}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.data.map((z) => (
                <TableRow key={z.id}>
                  <TableCell data-label="Zone">
                    <strong>{z.name}</strong>
                    <small>{z.notes}</small>
                  </TableCell>
                  <TableCell data-label="Fee">{money(z.fee)}</TableCell>
                  <TableCell data-label="Minimum order">
                    {money(z.minimum)}
                  </TableCell>
                  <TableCell data-label="Free delivery">
                    {z.freeAbove === null ? 'Not set' : money(z.freeAbove)}
                  </TableCell>
                  <TableCell data-label="Availability">
                    <StatusBadge value={z.active ? 'active' : 'suspended'} />
                  </TableCell>
                  <TableCell data-label="Actions">
                    <button className="text-link" onClick={() => setEdit(z)}>
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {edit !== undefined && (
        <ZoneEditor
          zone={edit}
          onClose={() => setEdit(undefined)}
          saved={() => {
            setEdit(undefined);
            void r.refresh();
          }}
        />
      )}
    </>
  );
}
function ZoneEditor({
  zone,
  onClose,
  saved,
}: {
  zone: Zone | null;
  onClose: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(zone?.name || ''),
    [fee, setFee] = useState((zone?.fee ?? 0) / 100),
    [minimum, setMin] = useState((zone?.minimum ?? 0) / 100),
    [free, setFree] = useState(
      zone?.freeAbove == null ? '' : String(zone.freeAbove / 100),
    ),
    [notes, setNotes] = useState(zone?.notes || ''),
    [active, setActive] = useState(zone?.active !== 0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title={zone ? 'Edit delivery zone' : 'Add delivery zone'}
      open
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              zone ? `zones/${zone.id}` : 'zones',
              zone ? 'PATCH' : 'POST',
              {
                name,
                fee: Math.round(fee * 100),
                minimum: Math.round(minimum * 100),
                freeAbove: free === '' ? null : Math.round(Number(free) * 100),
                notes,
                active,
              },
            );
            saved();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Zone name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
        </Field>
        <div className="form-grid">
          <Field label="Delivery fee ($)">
            <input
              type="number"
              min="0"
              step=".01"
              value={fee}
              onChange={(e) => setFee(+e.target.value)}
            />
          </Field>
          <Field label="Minimum order ($)">
            <input
              type="number"
              min="0"
              step=".01"
              value={minimum}
              onChange={(e) => setMin(+e.target.value)}
            />
          </Field>
        </div>
        <Field label="Free delivery from ($, optional)">
          <input
            type="number"
            min="0"
            step=".01"
            value={free}
            onChange={(e) => setFree(e.target.value)}
          />
        </Field>
        <Field label="Delivery time notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Toggle
          label="Delivery available"
          value={active}
          onChange={setActive}
        />
        <ErrorBox error={error} />
        <Submit busy={busy} />
      </form>
    </Modal>
  );
}
export function Team() {
  const r = useResource<User[]>('employees');
  const [open, setOpen] = useState(false),
    [error, setError] = useState(''),
    [busyId, setBusyId] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your team</h1>
          <p>One owner and up to two active employees on Starter.</p>
        </div>
        <button className="button" onClick={() => setOpen(true)}>
          Add employee
        </button>
      </div>
      <ErrorBox error={error || r.error} retry={r.refresh} />
      <div className="panel">
        <Table className="op-table">
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role & permissions</TableHead>
              <TableHead>Access</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell data-label="Employee">
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </TableCell>
                <TableCell data-label="Role">
                  {u.role === 'owner' ? (
                    roleLabels.owner
                  ) : (
                    <Choice
                      label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={busyId === u.id}
                      options={Object.entries(roleLabels)
                        .filter(([k]) => !['owner', 'super_admin'].includes(k))
                        .map(([value, label]) => ({ value, label }))}
                      onChange={async (role) => {
                        setBusyId(u.id);
                        try {
                          await api(`team/${u.id}`, 'PATCH', {
                            active: Boolean(u.active),
                            role,
                          });
                          await r.refresh();
                        } catch (e) {
                          setError(message(e));
                        } finally {
                          setBusyId('');
                        }
                      }}
                    />
                  )}
                </TableCell>
                <TableCell data-label="Access">
                  <StatusBadge value={u.active ? 'active' : 'suspended'} />
                </TableCell>
                <TableCell data-label="Actions">
                  {u.role !== 'owner' && (
                    <ActionButton
                      className="text-link"
                      busy={busyId === u.id}
                      busyLabel="Updating…"
                      onClick={async () => {
                        setBusyId(u.id);
                        try {
                          await api(`team/${u.id}`, 'PATCH', {
                            active: !u.active,
                            role: u.role,
                          });
                          await r.refresh();
                        } catch (e) {
                          setError(message(e));
                        } finally {
                          setBusyId('');
                        }
                      }}
                    >
                      {u.active ? 'Deactivate' : 'Activate'}
                    </ActionButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {open && (
        <StaffEditor
          onClose={() => setOpen(false)}
          saved={() => {
            setOpen(false);
            void r.refresh();
          }}
        />
      )}
    </>
  );
}
function StaffEditor({
  onClose,
  saved,
}: {
  onClose: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [role, setRole] = useState<Role>('picker'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      open
      title="Create employee access"
      description="Share the initial password privately. Employees can change it after signing in."
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('team', 'POST', { name, email, password, role });
            saved();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Employee name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="Employee email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Initial password">
          <input
            type="password"
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Choice
          label="Role"
          value={role}
          onChange={(v) => setRole(v as Role)}
          options={Object.entries(roleLabels)
            .filter(([k]) => !['owner', 'super_admin'].includes(k))
            .map(([value, label]) => ({ value, label }))}
        />
        <ErrorBox error={error} />
        <Submit busy={busy}>Create employee</Submit>
      </form>
    </Modal>
  );
}
export function StoreSettings({
  tenant,
  refresh,
}: {
  tenant: Tenant;
  refresh: () => void;
}) {
  const [s, setS] = useState<Settings>(settingsOf(tenant)),
    [busy, setBusy] = useState(false),
    [logoBusy, setLogoBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false);
  const editableSettings = {
    tagline: s.tagline,
    description: s.description,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    paymentOptions: s.paymentOptions,
    categories: s.categories,
    currency: s.currency,
    branding: s.branding,
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Your storefront</h1>
          <p>Make the shop feel like your business.</p>
        </div>
        <a
          className="button secondary"
          href={`/store/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          Visit storefront ↗
        </a>
      </div>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setSuccess(false);
          try {
            await api('settings', 'PATCH', editableSettings);
            setSuccess(true);
            refresh();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="panel-body form-stack">
          <div className="form-grid">
            <Field label="Storefront headline">
              <input
                value={s.tagline}
                onChange={(e) => setS({ ...s, tagline: e.target.value })}
              />
            </Field>
            <Field label="Contact phone">
              <input
                value={s.contactPhone}
                onChange={(e) => setS({ ...s, contactPhone: e.target.value })}
              />
            </Field>
            <Field label="Contact email">
              <input
                type="email"
                value={s.contactEmail}
                onChange={(e) => setS({ ...s, contactEmail: e.target.value })}
              />
            </Field>
            <Field label="Business address">
              <input
                value={s.address}
                onChange={(e) => setS({ ...s, address: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Store description">
            <textarea
              value={s.description}
              onChange={(e) => setS({ ...s, description: e.target.value })}
            />
          </Field>
          <Field label="Categories (one per line)">
            <textarea
              value={s.categories.join('\n')}
              onChange={(e) =>
                setS({ ...s, categories: e.target.value.split('\n') })
              }
            />
          </Field>
          <Field label="Manual payment options (one per line)">
            <textarea
              value={s.paymentOptions.join('\n')}
              onChange={(e) =>
                setS({ ...s, paymentOptions: e.target.value.split('\n') })
              }
            />
          </Field>
          <Field label="Business logo" hint="PNG or JPEG, up to 5 MB.">
            {s.branding?.logoId && (
              <div className="logo-preview">
                <img
                  src={`/api/files/${s.branding.logoId}`}
                  alt="Current business logo"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy || logoBusy}
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (!file) return;
                if (!['image/png', 'image/jpeg'].includes(file.type)) {
                  setError('Choose a PNG or JPEG business logo.');
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  setError('Business logo must be smaller than 5 MB.');
                  return;
                }
                setLogoBusy(true);
                setError('');
                try {
                  const uploaded = await uploadFile('files', file);
                  setS((current) => ({
                    ...current,
                    branding: { logoId: uploaded.id },
                  }));
                } catch (error) {
                  setError(message(error));
                } finally {
                  setLogoBusy(false);
                }
              }}
            />
            {logoBusy && <small role="status">Uploading logo…</small>}
            {s.branding?.logoId && !logoBusy && (
              <ActionButton
                className="text-link"
                onClick={() => setS({ ...s, branding: { logoId: null } })}
              >
                Remove logo
              </ActionButton>
            )}
          </Field>
          <ErrorBox error={error} />
          {success && (
            <div className="success-box" role="status">
              Storefront settings saved.
            </div>
          )}
          <div className="form-actions">
            <Submit
              busy={busy || logoBusy}
              busyLabel={logoBusy ? 'Uploading logo…' : 'Saving changes…'}
            />
          </div>
        </div>
      </form>
    </>
  );
}
export function Account() {
  const [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Account security</h1>
          <p>Changing your password signs out every active session.</p>
        </div>
      </div>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api('password', 'POST', { current, password });
            location.href = '/login';
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="panel-body form-stack">
          <Field label="Current password">
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <ErrorBox error={error} />
          <Submit busy={busy}>Change password and sign out</Submit>
        </div>
      </form>
    </>
  );
}
