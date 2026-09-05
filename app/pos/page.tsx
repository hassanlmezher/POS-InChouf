'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  ListChecks,
  Package,
  Truck,
  Users,
  Settings,
  BarChart3,
  LogOut,
  ArrowUpRight,
  Plus,
  Search,
  Download,
  Upload,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Brand,
  Loading,
  ErrorBox,
  EmptyState,
  StatusBadge,
  Field,
  Modal,
  ProductImage,
  Choice,
} from '@/components/shared';
import ProductEditor from '@/components/product-editor';
import OrderDetail from '@/components/order-detail';
import Checkout, { type CartLine } from '@/components/checkout';
import { Zones, Team, StoreSettings, Account } from '@/components/management';
import { api, useResource, message } from '@/lib/client';
import { parseCSV, exportCSV } from '@/lib/csv';
import {
  type User,
  type Tenant,
  type Order,
  type Product,
  type Zone,
  type Permission,
  type Event,
  rolePermissions,
  roleLabels,
  statuses,
  money,
  settingsOf,
} from '@/lib/types';
type View =
  | 'Overview'
  | 'Orders'
  | 'Work queues'
  | 'Products'
  | 'Delivery'
  | 'Delivery zones'
  | 'Customers'
  | 'Team'
  | 'Storefront'
  | 'Analytics'
  | 'Audit log'
  | 'Account';
const nav: { name: View; icon: typeof Package; permission?: Permission }[] = [
  { name: 'Overview', icon: LayoutDashboard, permission: 'orders' },
  { name: 'Orders', icon: ShoppingBag, permission: 'orders' },
  { name: 'Work queues', icon: ListChecks, permission: 'orders' },
  { name: 'Products', icon: Package, permission: 'products' },
  { name: 'Delivery', icon: Truck, permission: 'delivery' },
  { name: 'Delivery zones', icon: Truck, permission: 'settings' },
  { name: 'Customers', icon: Users, permission: 'customers' },
  { name: 'Team', icon: ShieldCheck, permission: 'team' },
  { name: 'Storefront', icon: Settings, permission: 'settings' },
  { name: 'Analytics', icon: BarChart3, permission: 'analytics' },
  { name: 'Audit log', icon: Clock, permission: 'settings' },
  { name: 'Account', icon: ShieldCheck },
];
const queueDefs = [
  {
    name: 'Ready to Pick',
    status: ['Confirmed'],
    description: 'Confirm quantities and collect the items.',
    icon: Package,
  },
  {
    name: 'Ready to Pack',
    status: ['Picking'],
    description: 'Check the details, then pack with care.',
    icon: CheckCircle2,
  },
  {
    name: 'Needs a Person',
    status: ['Needs Attention'],
    description: 'Resolve an issue before moving on.',
    icon: AlertCircle,
  },
  {
    name: 'Waiting for Customer',
    status: [],
    description: 'Proofs awaiting customer approval.',
    icon: Clock,
  },
  {
    name: 'Ready for Delivery',
    status: ['Packed'],
    description: 'Assign a driver and send it on its way.',
    icon: Truck,
  },
  {
    name: 'Delivery Exceptions',
    status: ['Failed Delivery', 'Returned'],
    description: 'Follow up and agree on the next step.',
    icon: AlertCircle,
  },
];
export default function Pos() {
  const me = useResource<{ user: User; tenant: Tenant | null }>('me');
  const [view, setView] = useState<View>('Overview'),
    [filter, setFilter] = useState('All orders'),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Product | null | undefined>(undefined),
    [manual, setManual] = useState(false),
    [error, setError] = useState('');
  const user = me.data?.user,
    tenant = me.data?.tenant;
  const perms = user ? rolePermissions[user.role] : [];
  const orders = useResource<Order[]>(
      user && perms.includes('orders') ? 'orders' : null,
    ),
    products = useResource<Product[]>(
      user && perms.includes('products') ? 'products' : null,
    );
  const audit = useResource<Event[]>(view === 'Audit log' ? 'audit' : null);
  const customers = useResource<
    {
      phone: string;
      name: string;
      email: string;
      orders: number;
      revenue: number;
      lastOrder: string;
    }[]
  >(view === 'Customers' ? 'customers' : null);
  const proofQueue = useResource<{ orderId: string }[]>(
    user && perms.includes('orders') ? 'waiting-proofs' : null,
  );
  const csvRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (user?.role === 'super_admin') location.href = '/admin';
    if (user?.role === 'assistant') setView('Products');
    if (user?.role === 'picker') setView('Work queues');
    if (user?.role === 'delivery_manager') setView('Delivery');
  }, [user?.role]);
  const all = orders.data || [];
  const refresh = () => {
    void orders.refresh();
    void products.refresh();
    void proofQueue.refresh();
  };
  const pending = new Set(proofQueue.data?.map((p) => p.orderId) || []);
  const visible = all.filter(
    (o) =>
      (view !== 'Delivery' ||
        ['Packed', 'Out for Delivery', 'Failed Delivery', 'Returned'].includes(
          o.status,
        )) &&
      (filter === 'All orders' ||
        o.status === filter ||
        (filter === 'Waiting for Customer' && pending.has(o.id))) &&
      `${o.reference} ${o.customer} ${o.phone}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (me.loading) return <Loading />;
  if (me.error || !user || !tenant)
    return (
      <main className="section">
        <Brand />
        <ErrorBox error={me.error || 'A business account is required.'} />
        <a className="button" href="/login">
          Sign in
        </a>
      </main>
    );
  const today = all.filter(
    (o) => new Date(o.createdAt).toDateString() === new Date().toDateString(),
  );
  const delivered = all.filter((o) => o.status === 'Delivered');
  const metrics = [
    [
      'New orders',
      String(all.filter((o) => o.status === 'New').length),
      'Ready to review',
    ],
    [
      'Being prepared',
      String(
        all.filter((o) => ['Confirmed', 'Picking', 'Packed'].includes(o.status))
          .length,
      ),
      'Your team’s next steps',
    ],
    [
      'Out for delivery',
      String(all.filter((o) => o.status === 'Out for Delivery').length),
      'On the way to customers',
    ],
    [
      'Today’s sales',
      money(
        today
          .filter((o) => o.status === 'Delivered')
          .reduce((s, o) => s + o.total, 0),
      ),
      'Delivered orders placed today',
    ],
  ];
  const go = (v: View) => {
    setView(v);
    setFilter('All orders');
    setSearch('');
    setError('');
  };
  return (
    <SidebarProvider className="dashboard-shell">
      <Sidebar className="app-sidebar">
        <SidebarHeader className="sidebar-brand">
          <Brand />
        </SidebarHeader>
        <div className="sidebar-store">
          <strong>{tenant.name}</strong>
          <small>
            {tenant.slug === 'internal-demo'
              ? 'INTERNAL DEMO · TEST DATA'
              : 'YOUR BUSINESS'}
          </small>
        </div>
        <SidebarContent>
          <div className="sidebar-label">WORKSPACE</div>
          <SidebarMenu className="app-menu">
            {nav
              .filter((n) => !n.permission || perms.includes(n.permission))
              .map((n) => (
                <SidebarMenuItem key={n.name}>
                  <SidebarMenuButton
                    isActive={view === n.name}
                    onClick={() => go(n.name)}
                  >
                    <n.icon size={18} />
                    <span>{n.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="sidebar-foot">
          <a
            className="text-link"
            href={`/store/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Open storefront ↗
          </a>
          <div className="user-block">
            <div className="avatar">
              {user.name
                .split(' ')
                .map((x) => x[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role]}</small>
            </div>
          </div>
          <button
            className="text-link"
            onClick={async () => {
              await api('logout', 'POST');
              location.href = '/login';
            }}
          >
            <LogOut size={14} style={{ display: 'inline', marginRight: 8 }} />
            Sign out
          </button>
        </SidebarFooter>
      </Sidebar>
      <main className="app-main">
        <header className="app-topbar">
          <div>
            <SidebarTrigger />
            <span>
              Workspace{' '}
              <span style={{ padding: '0 12px', color: '#c4b9ce' }}>/</span>
              <strong style={{ fontWeight: 500, color: '#62516f' }}>
                {view}
              </strong>
            </span>
          </div>
          <div>
            <span className="date-label">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="badge green">● Store active</span>
          </div>
        </header>
        <div className="workspace">
          <ErrorBox error={error || orders.error || products.error} />
          {view === 'Overview' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR DAILY PICTURE</div>
                  <h1>A clearer day starts here.</h1>
                  <p>Here’s what’s happening at {tenant.name}.</p>
                </div>
                {['owner', 'order_manager'].includes(user.role) && (
                  <button className="button" onClick={() => setManual(true)}>
                    <Plus size={17} />
                    Create order
                  </button>
                )}
              </div>
              <div className="metric-grid">
                {metrics.map(([label, value, sub], i) => (
                  <div
                    className={'metric ' + (i === 3 ? 'metric-accent' : '')}
                    key={label}
                  >
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{sub}</small>
                  </div>
                ))}
              </div>
              <div className="split-panel">
                <div className="panel">
                  <div className="panel-head">
                    <h3>Orders that need you</h3>
                    <button className="text-link" onClick={() => go('Orders')}>
                      All orders →
                    </button>
                  </div>
                  <OrderTable
                    orders={all
                      .filter((o) =>
                        ['New', 'Needs Attention', 'Failed Delivery'].includes(
                          o.status,
                        ),
                      )
                      .slice(0, 5)}
                    select={setSelected}
                  />
                </div>
                <div className="panel">
                  <div className="panel-head">
                    <h3>Order flow</h3>
                    <ListChecks size={18} color="#9f8aaf" />
                  </div>
                  <div className="panel-body status-list">
                    {statuses.map((s) => (
                      <button
                        className="status-count"
                        key={s}
                        onClick={() => {
                          go('Orders');
                          setFilter(s);
                        }}
                      >
                        <StatusBadge value={s} />
                        <strong>
                          {all.filter((o) => o.status === s).length}
                        </strong>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="split-panel">
                <div className="panel">
                  <div className="panel-head">
                    <h3>Low-stock watch</h3>
                  </div>
                  <div className="panel-body">
                    {products.data
                      ?.filter((p) => p.stock <= p.lowStock)
                      .map((p) => (
                        <div
                          className="status-count"
                          key={p.id}
                          style={{ padding: '10px 0' }}
                        >
                          <span>{p.name}</span>
                          <span className="badge orange">{p.stock} left</span>
                        </div>
                      ))}
                    {!products.data?.some((p) => p.stock <= p.lowStock) && (
                      <p>No low-stock products in your accessible catalog.</p>
                    )}
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-head">
                    <h3>Delivery collection</h3>
                  </div>
                  <div className="panel-body">
                    <div className="metric" style={{ border: 0, padding: 0 }}>
                      <span>Pending cash on delivery</span>
                      <strong>
                        {money(
                          all
                            .filter(
                              (o) =>
                                o.paymentMethod === 'Cash on delivery' &&
                                !['Cancelled', 'Returned'].includes(o.status),
                            )
                            .reduce(
                              (s, o) =>
                                s + Math.max(0, o.total - o.cashCollected),
                              0,
                            ),
                        )}
                      </strong>
                      <small>Order total less recorded cash collected</small>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {['Orders', 'Delivery'].includes(view) && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    {view === 'Delivery'
                      ? 'Delivery, in motion.'
                      : 'Every order. One clear view.'}
                  </h1>
                  <p>
                    {view === 'Delivery'
                      ? 'Assign, dispatch and follow up on the last mile.'
                      : 'From a new arrival to a successful delivery.'}
                  </p>
                </div>
                <div className="inline-actions">
                  <button
                    className="button secondary"
                    onClick={() =>
                      downloadCSV('orders.csv', [
                        [
                          'Reference',
                          'Customer',
                          'Phone',
                          'Status',
                          'Payment',
                          'Total USD',
                          'Address',
                        ],
                        ...visible.map((o) => [
                          o.reference,
                          o.customer,
                          o.phone,
                          o.status,
                          o.payment,
                          (o.total / 100).toFixed(2),
                          o.address,
                        ]),
                      ])
                    }
                  >
                    <Download size={16} />
                    Export
                  </button>
                  {['owner', 'order_manager'].includes(user.role) && (
                    <button className="button" onClick={() => setManual(true)}>
                      <Plus size={16} />
                      Create order
                    </button>
                  )}
                </div>
              </div>
              <div className="filter-pills">
                {['All orders', ...statuses].map((s) => (
                  <button
                    className={filter === s ? 'active' : ''}
                    key={s}
                    onClick={() => setFilter(s)}
                  >
                    {s}
                    <span>
                      {s === 'All orders'
                        ? all.length
                        : all.filter((o) => o.status === s).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="table-toolbar">
                <div className="search-wrap">
                  <Search />
                  <input
                    className="search-input"
                    placeholder="Search order, customer or phone"
                    aria-label="Search orders"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <small>{visible.length} orders · latest 500</small>
              </div>
              <div className="panel">
                <OrderTable orders={visible} select={setSelected} />
              </div>
            </>
          )}
          {view === 'Work queues' && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Know what comes next.</h1>
                  <p>Pick a queue. Focus on the work. Keep orders moving.</p>
                </div>
                <button className="button secondary" onClick={refresh}>
                  Refresh queues
                </button>
              </div>
              <div className="queue-grid">
                {queueDefs.map((q) => (
                  <button
                    className="queue-card"
                    key={q.name}
                    onClick={() => {
                      go('Orders');
                      setFilter(
                        q.name === 'Waiting for Customer'
                          ? q.name
                          : q.status[0],
                      );
                      if (q.name === 'Delivery Exceptions') {
                        setFilter('Failed Delivery');
                      }
                    }}
                  >
                    <q.icon className="queue-icon" size={22} />
                    <strong>
                      {q.name === 'Waiting for Customer'
                        ? pending.size
                        : all.filter((o) => q.status.includes(o.status)).length}
                    </strong>
                    <h3>{q.name}</h3>
                    <p>{q.description}</p>
                  </button>
                ))}
              </div>
            </>
          )}
          {view === 'Products' && (
            <>
              <div className="page-heading">
                <div>
                  <h1>A catalog worth keeping.</h1>
                  <p>Products, options and stock, all in one place.</p>
                </div>
                <button className="button" onClick={() => setEditing(null)}>
                  <Plus size={17} />
                  Add product
                </button>
              </div>
              <div className="table-toolbar">
                <div className="search-wrap">
                  <Search />
                  <input
                    className="search-input"
                    placeholder="Search products or SKU"
                    aria-label="Search products"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="inline-actions">
                  <button
                    className="button secondary small"
                    onClick={() =>
                      downloadCSV('products.csv', [
                        [
                          'name',
                          'description',
                          'category',
                          'sku',
                          'price',
                          'stock',
                        ],
                        ...(products.data || []).map((p) => [
                          p.name,
                          p.description,
                          p.category,
                          p.sku,
                          p.price / 100,
                          p.stock,
                        ]),
                      ])
                    }
                  >
                    <Download size={15} />
                    Export CSV
                  </button>
                  <button
                    className="button secondary small"
                    onClick={() => csvRef.current?.click()}
                  >
                    <Upload size={15} />
                    Import CSV
                  </button>
                  <input
                    ref={csvRef}
                    type="file"
                    accept=".csv"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const parsed = parseCSV(await f.text());
                        const headers = parsed.shift()!;
                        const required = [
                          'name',
                          'description',
                          'category',
                          'sku',
                          'price',
                          'stock',
                        ];
                        if (required.some((k) => !headers.includes(k)))
                          throw new Error(
                            'CSV needs columns: ' + required.join(', '),
                          );
                        if (parsed.length > 100)
                          throw new Error(
                            'Import at most 100 products at once.',
                          );
                        let count = 0;
                        for (const row of parsed) {
                          const get = (k: string) =>
                            row[headers.indexOf(k)] || '';
                          try {
                            await api('products', 'POST', {
                              name: get('name'),
                              description: get('description'),
                              category: get('category'),
                              sku: get('sku'),
                              price: Math.round(Number(get('price')) * 100),
                              stock: Number(get('stock')),
                              lowStock: 5,
                              active: true,
                              image: '',
                              variants: [],
                              customFields: [],
                            });
                            count++;
                          } catch (e) {
                            throw new Error(
                              `${count} products imported. Row ${count + 2}: ${message(e)}`,
                            );
                          }
                        }
                        setError('');
                        await products.refresh();
                        alert(`${count} products imported.`);
                      } catch (e) {
                        setError(message(e));
                        await products.refresh();
                      } finally {
                        if (csvRef.current) csvRef.current.value = '';
                      }
                    }}
                  />
                </div>
              </div>
              {!products.data?.length ? (
                <EmptyState
                  title="Your catalog starts here"
                  description="Add your first product or import a CSV."
                />
              ) : (
                <div className="product-admin-grid">
                  {products.data
                    .filter((p) =>
                      `${p.name} ${p.sku}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <article className="product-admin-card" key={p.id}>
                        <div className="product-photo">
                          <ProductImage src={p.image} name={p.name} />
                        </div>
                        <div className="panel-body">
                          <small>
                            {p.category} · {p.sku}
                          </small>
                          <h3>{p.name}</h3>
                          <strong>{money(p.price)}</strong>
                          <div className="section-heading">
                            <span
                              className={
                                'badge ' +
                                (p.stock <= p.lowStock ? 'orange' : 'green')
                              }
                            >
                              {p.active ? `${p.stock} in stock` : 'Inactive'}
                            </span>
                            <button
                              className="text-link"
                              onClick={() => setEditing(p)}
                            >
                              Edit ↗
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </>
          )}
          {view === 'Delivery zones' && <Zones />}
          {view === 'Team' && <Team />}
          {view === 'Storefront' && (
            <StoreSettings tenant={tenant} refresh={me.refresh} />
          )}{' '}
          {view === 'Account' && <Account />}
          {view === 'Customers' && (
            <>
              <div className="page-heading">
                <div>
                  <h1>The people behind the orders.</h1>
                  <p>
                    Customer history is grouped by the phone number they
                    provide.
                  </p>
                </div>
              </div>
              <ErrorBox error={customers.error} />
              <div className="panel">
                <Table className="op-table">
                  <TableHeader>
                    <TableRow>
                      {[
                        'Customer',
                        'Contact',
                        'Orders',
                        'Delivered sales',
                        'Last order',
                      ].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.data?.map((c) => (
                      <TableRow key={c.phone}>
                        <TableCell>
                          <button
                            className="row-link"
                            onClick={() => {
                              go('Orders');
                              setSearch(c.phone);
                            }}
                          >
                            {c.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          {c.phone}
                          <small>{c.email}</small>
                        </TableCell>
                        <TableCell>{c.orders}</TableCell>
                        <TableCell>{money(c.revenue)}</TableCell>
                        <TableCell>
                          {new Date(c.lastOrder).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {customers.data?.length === 0 && (
                  <EmptyState
                    title="Your customer history will grow here"
                    description="Place your first order to see customer history."
                  />
                )}
              </div>
            </>
          )}
          {view === 'Analytics' && (
            <>
              <div className="page-heading">
                <div>
                  <h1>A little perspective.</h1>
                  <p>Based on the latest 500 orders in this workspace.</p>
                </div>
              </div>
              <div className="metric-grid">
                {[
                  [
                    'Delivered sales',
                    money(delivered.reduce((s, o) => s + o.total, 0)),
                  ],
                  [
                    'Average delivered order',
                    money(
                      delivered.length
                        ? delivered.reduce((s, o) => s + o.total, 0) /
                            delivered.length
                        : 0,
                    ),
                  ],
                  ['Delivered orders', delivered.length],
                  [
                    'Returns & failures',
                    all.filter((o) =>
                      ['Returned', 'Failed Delivery'].includes(o.status),
                    ).length,
                  ],
                ].map(([a, b]) => (
                  <div className="metric" key={a}>
                    <span>{a}</span>
                    <strong>{b}</strong>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3>Orders placed · last seven days</h3>
                </div>
                <div className="panel-body">
                  <div className="chart-bars">
                    {Array.from({ length: 7 }, (_, i) => {
                      const day = new Date(Date.now() - (6 - i) * 86400000);
                      const count = all.filter(
                        (o) =>
                          new Date(o.createdAt).toDateString() ===
                          day.toDateString(),
                      ).length;
                      return (
                        <div className="chart-bar" key={i}>
                          <span>{count}</span>
                          <div
                            style={{
                              height: `${Math.min(125, 5 + count * 8)}px`,
                            }}
                          />
                          <span>
                            {day.toLocaleDateString('en-US', {
                              weekday: 'short',
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
          {view === 'Audit log' && (
            <>
              <div className="page-heading">
                <div>
                  <h1>Activity, accounted for.</h1>
                  <p>Important changes across your business.</p>
                </div>
              </div>
              <div className="panel">
                <div className="panel-body activity-list">
                  {audit.data?.map((e) => (
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
        </div>
      </main>
      {editing !== undefined && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            refresh();
          }}
        />
      )}
      {selected && (
        <OrderDetail
          id={selected}
          user={user}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}{' '}
      {manual && (
        <ManualOrder
          tenant={tenant}
          onClose={() => setManual(false)}
          onSaved={refresh}
        />
      )}
    </SidebarProvider>
  );
}
function OrderTable({
  orders,
  select,
}: {
  orders: Order[];
  select: (id: string) => void;
}) {
  if (!orders.length)
    return (
      <EmptyState
        title="All clear here"
        description="Orders matching this view will appear here."
      />
    );
  return (
    <Table className="op-table">
      <TableHeader>
        <TableRow>
          <TableHead>Order / customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id}>
            <TableCell>
              <button className="row-link" onClick={() => select(o.id)}>
                {o.reference}
              </button>
              <small>{o.customer}</small>
            </TableCell>
            <TableCell>
              <StatusBadge value={o.status} />
            </TableCell>
            <TableCell>{money(o.total)}</TableCell>
            <TableCell>
              <StatusBadge value={o.payment} />
            </TableCell>
            <TableCell>
              <button
                aria-label={`Open ${o.reference}`}
                onClick={() => select(o.id)}
              >
                <ArrowUpRight size={17} />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function downloadCSV(filename: string, rows: (string | number | boolean | null | undefined)[][]) {
  const url = URL.createObjectURL(
    new Blob([exportCSV(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function ManualOrder({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const r = useResource<{ products: Product[]; zones: Zone[] }>('catalog');
  const [lines, setLines] = useState<CartLine[]>([]),
    [done, setDone] = useState<{
      trackingUrl: string;
      reference: string;
    } | null>(null);
  return (
    <Modal
      open
      title={done ? 'Order created' : 'Create an order'}
      description="Enter an order received in person or by phone."
      onClose={onClose}
    >
      {done ? (
        <div className="form-stack">
          <div className="success-box">
            {done.reference} is ready in the order queue.
          </div>
          <a
            className="text-link"
            href={done.trackingUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open customer tracking ↗
          </a>
          <button className="button" onClick={onClose}>
            Done
          </button>
        </div>
      ) : r.data ? (
        <div className="form-stack">
          <Choice
            label="Add product"
            value="none"
            onChange={(v) => {
              const p = r.data!.products.find((p) => p.id === v);
              if (p)
                setLines([
                  ...lines,
                  {
                    productId: v,
                    quantity: 1,
                    variant: JSON.parse(p.variants)[0]?.name || '',
                    custom: {},
                  },
                ]);
            }}
            options={[
              { value: 'none', label: 'Select a product' },
              ...r.data.products.map((p) => ({
                value: p.id,
                label: `${p.name} · ${money(p.price)}`,
              })),
            ]}
          />
          {lines.map((l, i) => {
            const p = r.data!.products.find((p) => p.id === l.productId)!;
            return (
              <div className="note-block form-stack" key={i}>
                <strong>{p.name}</strong>
                <Field label="Quantity">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={l.quantity}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, n) =>
                          n === i ? { ...x, quantity: +e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                {JSON.parse(p.variants).length > 0 && (
                  <Choice
                    label="Variant"
                    value={l.variant}
                    onChange={(v) =>
                      setLines(
                        lines.map((x, n) =>
                          n === i ? { ...x, variant: v } : x,
                        ),
                      )
                    }
                    options={JSON.parse(p.variants).map(
                      (v: { name: string }) => v.name,
                    )}
                  />
                )}{' '}
                {JSON.parse(p.customFields)
                  .filter((f: { type: string }) => f.type === 'text')
                  .map((f: { name: string; required: boolean }) => (
                    <Field label={f.name} key={f.name}>
                      <input
                        required={f.required}
                        value={l.custom[f.name] || ''}
                        onChange={(e) =>
                          setLines(
                            lines.map((x, n) =>
                              n === i
                                ? {
                                    ...x,
                                    custom: {
                                      ...x.custom,
                                      [f.name]: e.target.value,
                                    },
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                <button
                  className="text-link"
                  onClick={() => setLines(lines.filter((_, n) => n !== i))}
                >
                  Remove item
                </button>
              </div>
            );
          })}
          <Checkout
            products={r.data.products}
            zones={r.data.zones}
            settings={settingsOf(tenant)}
            lines={lines}
            endpoint="orders"
            onComplete={(d) => {
              setDone(d);
              onSaved();
            }}
          />
        </div>
      ) : (
        <Loading />
      )}
      <ErrorBox error={r.error} />
    </Modal>
  );
}
