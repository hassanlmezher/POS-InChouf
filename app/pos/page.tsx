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
  MoreVertical,
  Loader2,
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
  Submit,
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
  type Settlement,
  rolePermissions,
  roleLabels,
  statuses,
  transitions,
  money,
  settingsOf,
} from '@/lib/types';

type CustomerSummary = {
  phone: string;
  name: string;
  email: string;
  orders: number;
  revenue: number;
  outstanding: number;
  lastOrder: string;
};

type CustomerProfile = {
  customer: CustomerSummary & { deliveredOrders: number };
  orders: {
    id: string;
    reference: string;
    status: string;
    payment: string;
    total: number;
    cashCollected: number;
    createdAt: string;
  }[];
};

type SettlementOrder = {
  settlementId: string;
  amount: number;
  reference: string;
  customer: string;
  status: string;
  payment: string;
};
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
    [debouncedSearch, setDebouncedSearch] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [selectedCustomer, setSelectedCustomer] = useState<string | null>(null),
    [editing, setEditing] = useState<Product | null | undefined>(undefined),
    [manual, setManual] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState<{
      kind: 'success' | 'error';
      text: string;
    } | null>(null);
  const user = me.data?.user,
    tenant = me.data?.tenant;
  const perms = user ? rolePermissions[user.role] : [];
  const orders = useResource<Order[]>(
      user && perms.includes('orders') ? 'orders' : null,
      { intervalMs: 15000 },
    ),
    products = useResource<Product[]>(
      user && perms.includes('products') ? 'products' : null,
      { intervalMs: 30000 },
    ),
    team = useResource<User[]>(
      user && perms.includes('orders') ? 'team' : null,
      { intervalMs: 30000 },
    );
  const audit = useResource<Event[]>(view === 'Audit log' ? 'audit' : null, {
    intervalMs: 30000,
  });
  const customers = useResource<CustomerSummary[]>(
    view === 'Customers'
      ? `customers${debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : ''}`
      : null,
    { intervalMs: 30000 },
  );
  const customerProfile = useResource<CustomerProfile>(
    selectedCustomer
      ? `customers/${encodeURIComponent(selectedCustomer)}`
      : null,
    { intervalMs: 30000 },
  );
  const settlements = useResource<{
    settlements: Settlement[];
    orders: SettlementOrder[];
  }>(view === 'Delivery' && user?.role === 'owner' ? 'settlements' : null, {
    intervalMs: 30000,
  });
  const csvRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (user?.role === 'super_admin') location.href = '/admin';
    if (user?.role === 'assistant') setView('Products');
    if (user?.role === 'picker') setView('Work queues');
    if (user?.role === 'delivery_manager') setView('Delivery');
  }, [user?.role]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const all = orders.data || [];
  const refresh = () => {
    void orders.refresh();
    void products.refresh();
    void team.refresh();
  };
  const visible = all.filter(
    (o) =>
      (view !== 'Delivery' ||
        ['Packed', 'Out for Delivery', 'Failed Delivery', 'Returned'].includes(
          o.status,
        )) &&
      (filter === 'All orders' || o.status === filter) &&
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
  const deliveredValue = delivered.reduce((s, o) => s + o.total, 0);
  const paidRevenue = all
    .filter((o) => o.payment === 'Paid')
    .reduce((s, o) => s + o.total, 0);
  const outstanding = all
    .filter(
      (o) =>
        o.payment !== 'Paid' &&
        !['Cancelled', 'Returned', 'Failed Delivery'].includes(o.status),
    )
    .reduce((s, o) => s + Math.max(0, o.total - o.cashCollected), 0);
  const cashCollected = all.reduce((s, o) => s + o.cashCollected, 0);
  const codExpected = all
    .filter(
      (o) =>
        o.paymentMethod === 'Cash on delivery' &&
        !['Cancelled', 'Returned', 'Failed Delivery'].includes(o.status),
    )
    .reduce((s, o) => s + Math.max(0, o.total - o.cashCollected), 0);
  const refunds = all
    .filter((o) => o.payment === 'Refunded')
    .reduce((s, o) => s + o.total, 0);
  const tenantLogo = settingsOf(tenant).branding?.logoId
    ? `/api/store/${tenant.slug}/logo`
    : '';
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
      'Delivered value today',
      money(
        today
          .filter((o) => o.status === 'Delivered')
          .reduce((s, o) => s + o.total, 0),
      ),
      'Order value, not collected cash',
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
          {tenantLogo ? (
            <a className="brand tenant-app-brand" href="/pos">
              <img src={tenantLogo} alt={`${tenant.name} logo`} />
              <span>{tenant.name}</span>
            </a>
          ) : (
            <Brand />
          )}
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
                    user={user}
                    team={team.data || []}
                    onSaved={refresh}
                    notify={setToast}
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
                      <strong>{money(codExpected)}</strong>
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
                  {['owner', 'order_manager'].includes(user.role) && (
                    <a className="button secondary" href="/api/orders/export">
                      <Download size={16} />
                      Export
                    </a>
                  )}
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
                <OrderTable
                  orders={visible}
                  select={setSelected}
                  user={user}
                  team={team.data || []}
                  onSaved={refresh}
                  notify={setToast}
                />
              </div>
              {view === 'Delivery' && user.role === 'owner' && (
                <SettlementPanel
                  data={settlements.data}
                  error={settlements.error}
                  refresh={async () => {
                    await settlements.refresh();
                    refresh();
                  }}
                />
              )}
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
                      setFilter(q.status[0]);
                      if (q.name === 'Delivery Exceptions') {
                        setFilter('Failed Delivery');
                      }
                    }}
                  >
                    <q.icon className="queue-icon" size={22} />
                    <strong>
                      {all.filter((o) => q.status.includes(o.status)).length}
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
              <div className="table-toolbar">
                <div className="search-wrap">
                  <Search />
                  <input
                    className="search-input"
                    placeholder="Search name, phone or email"
                    aria-label="Search customers"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <small>{customers.data?.length || 0} customers</small>
              </div>
              <div className="panel">
                <Table className="op-table">
                  <TableHeader>
                    <TableRow>
                      {[
                        'Customer',
                        'Contact',
                        'Orders',
                        'Delivered value',
                        'Outstanding',
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
                            onClick={() => setSelectedCustomer(c.phone)}
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
                        <TableCell>{money(c.outstanding)}</TableCell>
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
                  ['Delivered order value', money(deliveredValue)],
                  ['Paid revenue', money(paidRevenue)],
                  ['Outstanding amount', money(outstanding)],
                  ['Cash recorded', money(cashCollected)],
                  [
                    'Average delivered order',
                    money(
                      delivered.length ? deliveredValue / delivered.length : 0,
                    ),
                  ],
                  ['Delivered orders', delivered.length],
                  [
                    'Returns & failures',
                    all.filter((o) =>
                      ['Returned', 'Failed Delivery'].includes(o.status),
                    ).length,
                  ],
                  ['Refunds', money(refunds)],
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
      {toast && (
        <div
          className={`toast-message ${toast.kind}`}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          {toast.text}
        </div>
      )}
      {selectedCustomer && (
        <Modal
          open
          title="Customer profile"
          description="Order history grouped by phone number."
          onClose={() => setSelectedCustomer(null)}
        >
          {customerProfile.loading ? (
            <Loading />
          ) : (
            <div className="form-stack">
              <ErrorBox
                error={customerProfile.error}
                retry={customerProfile.refresh}
              />
              {customerProfile.data && (
                <>
                  <div className="detail-grid">
                    <div>
                      <small>Name</small>
                      <strong>{customerProfile.data.customer.name}</strong>
                      <p>{customerProfile.data.customer.phone}</p>
                      <p>{customerProfile.data.customer.email}</p>
                    </div>
                    <div>
                      <small>History</small>
                      <p>{customerProfile.data.customer.orders} orders</p>
                      <p>
                        {customerProfile.data.customer.deliveredOrders}{' '}
                        delivered
                      </p>
                      <p>
                        Outstanding{' '}
                        {money(customerProfile.data.customer.outstanding)}
                      </p>
                    </div>
                  </div>
                  <Table className="op-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerProfile.data.orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <button
                              className="row-link"
                              onClick={() => {
                                setSelectedCustomer(null);
                                setSelected(o.id);
                              }}
                            >
                              {o.reference}
                            </button>
                            <small>
                              {new Date(o.createdAt).toLocaleDateString()}
                            </small>
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={o.status} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={o.payment} />
                          </TableCell>
                          <TableCell>{money(o.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </SidebarProvider>
  );
}
function OrderTable({
  orders,
  select,
  user,
  team,
  onSaved,
  notify,
}: {
  orders: Order[];
  select: (id: string) => void;
  user: User;
  team: User[];
  onSaved: () => void;
  notify: (toast: { kind: 'success' | 'error'; text: string }) => void;
}) {
  const [busyId, setBusyId] = useState(''),
    [handoff, setHandoff] = useState<Order | null>(null),
    [exception, setException] = useState<{
      order: Order;
      label: string;
      payload: Record<string, unknown>;
    } | null>(null),
    [handoffMethod, setHandoffMethod] = useState<
      'internal_driver' | 'external_courier'
    >('internal_driver'),
    [handoffDriver, setHandoffDriver] = useState('none'),
    [handoffProvider, setHandoffProvider] = useState(''),
    [reason, setReason] = useState('');
  const drivers = team.filter((u) =>
    ['owner', 'delivery_manager'].includes(u.role),
  );
  const primary: Record<string, { label: string; status: string }> = {
    New: { label: 'Confirm order', status: 'Confirmed' },
    Confirmed: { label: 'Start picking', status: 'Picking' },
    Picking: { label: 'Mark as packed', status: 'Packed' },
    Packed: { label: 'Hand off for delivery', status: 'Out for Delivery' },
    'Out for Delivery': { label: 'Mark delivered', status: 'Delivered' },
  };
  const deliveryExceptionStatus: Record<string, string> = {
    Failed: 'Failed Delivery',
    'Customer unavailable': 'Failed Delivery',
    Returned: 'Returned',
  };
  const manager = ['owner', 'order_manager'].includes(user.role);
  const submit = async (
    order: Order,
    payload: Record<string, unknown>,
    success: string,
  ) => {
    setBusyId(order.id);
    try {
      await api(`orders/${order.id}`, 'PATCH', {
        ...payload,
        version: order.version,
      });
      onSaved();
      notify({ kind: 'success', text: success });
      return true;
    } catch (e) {
      notify({ kind: 'error', text: message(e) });
      return false;
    } finally {
      setBusyId('');
    }
  };
  const openHandoff = (order: Order) => {
    setHandoff(order);
    setHandoffMethod(order.deliveryMethod || 'internal_driver');
    setHandoffDriver(order.driverId || 'none');
    setHandoffProvider(order.deliveryProvider || '');
  };
  const handoffReady = (order: Order) =>
    order.deliveryMethod === 'external_courier'
      ? !!order.deliveryProvider.trim()
      : !!order.driverId;
  const submitPrimary = (order: Order) => {
    const next = primary[order.status];
    if (!next) return;
    if (
      user.role === 'picker' &&
      !['Confirmed', 'Picking'].includes(order.status)
    )
      return;
    if (user.role === 'delivery_manager') {
      if (order.status === 'Packed')
        void submit(
          order,
          { deliveryStatus: 'On the way' },
          `${order.reference} is out for delivery.`,
        );
      if (order.status === 'Out for Delivery')
        void submit(
          order,
          { deliveryStatus: 'Delivered' },
          `${order.reference} was marked delivered.`,
        );
      return;
    }
    if (!manager && user.role !== 'picker') return;
    if (order.status === 'Packed') {
      if (!handoffReady(order)) {
        openHandoff(order);
        return;
      }
      void submit(
        order,
        {
          status: next.status,
          deliveryMethod: order.deliveryMethod,
          driverId:
            order.deliveryMethod === 'external_courier' ? null : undefined,
          deliveryProvider:
            order.deliveryMethod === 'external_courier'
              ? order.deliveryProvider
              : '',
        },
        `${order.reference} is out for delivery.`,
      );
      return;
    }
    void submit(order, { status: next.status }, `${order.reference} updated.`);
  };
  const canUsePrimary = (order: Order) => {
    if (!primary[order.status]) return false;
    if (user.role === 'picker')
      return ['Confirmed', 'Picking'].includes(order.status);
    if (user.role === 'delivery_manager')
      return ['Packed', 'Out for Delivery'].includes(order.status);
    return manager;
  };
  const openException = (
    order: Order,
    label: string,
    payload: Record<string, unknown>,
  ) => {
    setException({ order, label, payload });
    setReason('');
  };
  if (!orders.length)
    return (
      <EmptyState
        title="All clear here"
        description="Orders matching this view will appear here."
      />
    );
  return (
    <>
      <Table className="op-table">
        <TableHeader>
          <TableRow>
            <TableHead>Order / customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Next step</TableHead>
            <TableHead>More</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const busy = busyId === o.id;
            const normal = primary[o.status];
            const deliveryExceptions = [
              'Failed',
              'Customer unavailable',
              'Returned',
            ].filter(
              (s) =>
                ['owner', 'delivery_manager'].includes(user.role) &&
                transitions[o.status].includes(
                  deliveryExceptionStatus[s] as never,
                ),
            );
            const statusExceptions = transitions[o.status].filter(
              (s) =>
                [
                  'Cancelled',
                  'Returned',
                  'Needs Attention',
                  'Failed Delivery',
                ].includes(s) &&
                (user.role !== 'picker' || s === 'Needs Attention') &&
                user.role !== 'delivery_manager' &&
                !(s === 'Returned' && deliveryExceptions.includes('Returned')),
            );
            return (
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
                  {canUsePrimary(o) && normal ? (
                    <button
                      className="button small quick-action"
                      disabled={busy}
                      onClick={() => submitPrimary(o)}
                    >
                      {busy ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : null}
                      {busy ? 'Saving...' : normal.label}
                    </button>
                  ) : (
                    <small>No next step</small>
                  )}
                </TableCell>
                <TableCell>
                  <div className="row-action-group">
                    {(statusExceptions.length > 0 ||
                      deliveryExceptions.length > 0) && (
                      <details className="row-overflow">
                        <summary aria-label={`More actions for ${o.reference}`}>
                          <MoreVertical size={17} />
                        </summary>
                        <div className="row-overflow-menu">
                          {statusExceptions.map((s) => (
                            <button
                              key={s}
                              disabled={busy}
                              onClick={() => openException(o, s, { status: s })}
                            >
                              {s}
                            </button>
                          ))}
                          {deliveryExceptions.map((s) => (
                            <button
                              key={s}
                              disabled={busy}
                              onClick={() =>
                                openException(o, s, { deliveryStatus: s })
                              }
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Open ${o.reference}`}
                      onClick={() => select(o.id)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {handoff && (
        <Modal
          open
          title="Hand off for delivery"
          description="Add the missing delivery detail before this order leaves."
          onClose={() => setHandoff(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const provider = handoffProvider.trim();
              if (
                handoffMethod === 'internal_driver' &&
                handoffDriver === 'none'
              )
                return;
              if (handoffMethod === 'external_courier' && !provider) return;
              void submit(
                handoff,
                handoffMethod === 'internal_driver'
                  ? {
                      status: 'Out for Delivery',
                      deliveryMethod: 'internal_driver',
                      driverId: handoffDriver,
                      deliveryProvider: '',
                    }
                  : {
                      status: 'Out for Delivery',
                      deliveryMethod: 'external_courier',
                      driverId: null,
                      deliveryProvider: provider,
                    },
                `${handoff.reference} is out for delivery.`,
              ).then((ok) => ok && setHandoff(null));
            }}
          >
            <Choice
              label="Delivery method"
              value={handoffMethod}
              onChange={(v) =>
                setHandoffMethod(v as 'internal_driver' | 'external_courier')
              }
              options={[
                { value: 'internal_driver', label: 'Internal driver' },
                { value: 'external_courier', label: 'External courier' },
              ]}
            />
            {handoffMethod === 'internal_driver' ? (
              <Choice
                label="Driver"
                value={handoffDriver}
                onChange={setHandoffDriver}
                options={[
                  { value: 'none', label: 'Choose a driver' },
                  ...drivers.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            ) : (
              <Field label="Courier company">
                <input
                  value={handoffProvider}
                  maxLength={120}
                  onChange={(e) => setHandoffProvider(e.target.value)}
                  placeholder="Courier or delivery company"
                />
              </Field>
            )}
            {handoffMethod === 'internal_driver' && !drivers.length && (
              <small className="danger-text">
                Add an active delivery manager before using internal delivery.
              </small>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busyId === handoff.id}
                onClick={() => setHandoff(null)}
              >
                Cancel
              </button>
              <button
                className="button"
                type="submit"
                disabled={
                  busyId === handoff.id ||
                  (handoffMethod === 'internal_driver' &&
                    handoffDriver === 'none') ||
                  (handoffMethod === 'external_courier' &&
                    !handoffProvider.trim())
                }
              >
                {busyId === handoff.id ? 'Saving...' : 'Hand off'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {exception && (
        <Modal
          open
          title={exception.label}
          description="Add the reason for this exception."
          onClose={() => setException(null)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason.trim()) return;
              void submit(
                exception.order,
                { ...exception.payload, reason: reason.trim() },
                `${exception.order.reference} updated.`,
              ).then((ok) => ok && setException(null));
            }}
          >
            <Field label="Reason">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly explain what happened"
              />
            </Field>
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busyId === exception.order.id}
                onClick={() => setException(null)}
              >
                Cancel
              </button>
              <button
                className="button"
                type="submit"
                disabled={busyId === exception.order.id || !reason.trim()}
              >
                {busyId === exception.order.id ? 'Saving...' : 'Save exception'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function SettlementPanel({
  data,
  error,
  refresh,
}: {
  data: { settlements: Settlement[]; orders: SettlementOrder[] } | null;
  error: string;
  refresh: () => Promise<void>;
}) {
  const team = useResource<User[]>('team', { intervalMs: 30000 });
  const [method, setMethod] = useState<'internal_driver' | 'external_courier'>(
      'internal_driver',
    ),
    [driverId, setDriverId] = useState('none'),
    [provider, setProvider] = useState(''),
    [periodStart, setPeriodStart] = useState(''),
    [periodEnd, setPeriodEnd] = useState(''),
    [actual, setActual] = useState(''),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState(''),
    [success, setSuccess] = useState('');
  const drivers =
    team.data?.filter((u) => ['owner', 'delivery_manager'].includes(u.role)) ||
    [];
  const toIso = (date: string, end = false) =>
    date
      ? new Date(
          `${date}T${end ? '23:59:59.999' : '00:00:00.000'}`,
        ).toISOString()
      : null;
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h3>Cash reconciliation</h3>
          <small>Settle delivered COD orders by driver or courier batch.</small>
        </div>
      </div>
      <div className="panel-body form-stack">
        <ErrorBox error={error || team.error || localError} />
        {success && <div className="success-box">{success}</div>}
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setLocalError('');
            setSuccess('');
            try {
              const result = await api<{
                expected: number;
                actual: number;
                variance: number;
                status: string;
              }>('settlements', 'POST', {
                method,
                driverId: method === 'internal_driver' ? driverId : null,
                provider: method === 'external_courier' ? provider : '',
                periodStart: toIso(periodStart),
                periodEnd: toIso(periodEnd, true),
                actual: Math.round(Number(actual) * 100),
              });
              setActual('');
              setSuccess(
                `Expected ${money(result.expected)} / Actual ${money(result.actual)} / Difference ${money(result.variance)} (${result.status}).`,
              );
              await refresh();
            } catch (e) {
              setLocalError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Choice
              label="Settlement type"
              value={method}
              onChange={(v) =>
                setMethod(v as 'internal_driver' | 'external_courier')
              }
              options={[
                { value: 'internal_driver', label: 'Internal driver' },
                { value: 'external_courier', label: 'External courier' },
              ]}
            />
            {method === 'internal_driver' ? (
              <Choice
                label="Driver"
                value={driverId}
                onChange={setDriverId}
                options={[
                  { value: 'none', label: 'Choose driver' },
                  ...drivers.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            ) : (
              <Field label="Courier company">
                <input
                  value={provider}
                  maxLength={120}
                  onChange={(e) => setProvider(e.target.value)}
                  required
                />
              </Field>
            )}
            <Field label="Period start">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </Field>
            <Field label="Period end">
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </Field>
            <Field label="Actual returned ($)">
              <input
                type="number"
                min="0"
                step=".01"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                required
              />
            </Field>
          </div>
          <Submit
            busy={busy}
            disabled={
              actual === '' ||
              (method === 'internal_driver' && driverId === 'none') ||
              (method === 'external_courier' && !provider.trim())
            }
          >
            Create settlement
          </Submit>
        </form>
        {data?.settlements.length ? (
          <div className="activity-list">
            {data.settlements.map((settlement) => {
              const lines = data.orders.filter(
                (o) => o.settlementId === settlement.id,
              );
              return (
                <div className="activity-item" key={settlement.id}>
                  <strong>
                    {settlement.method === 'external_courier'
                      ? settlement.provider
                      : drivers.find((d) => d.id === settlement.driverId)
                          ?.name || 'Internal driver'}
                  </strong>
                  <p>
                    Expected {money(settlement.expected)} / Actual{' '}
                    {money(settlement.actual)} / Difference{' '}
                    {money(settlement.variance)} ({settlement.status})
                  </p>
                  <small>
                    {new Date(settlement.createdAt).toLocaleString()}
                  </small>
                  <div className="settlement-orders">
                    {lines.map((line) => (
                      <span key={line.reference}>
                        {line.reference} · {line.customer} ·{' '}
                        {money(line.amount)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No settlements yet"
            description="Completed COD delivery batches will be recorded here."
          />
        )}
      </div>
    </div>
  );
}

function downloadCSV(
  filename: string,
  rows: (string | number | boolean | null | undefined)[][],
) {
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
  const [productSearch, setProductSearch] = useState(''),
    [debouncedProductSearch, setDebouncedProductSearch] = useState(''),
    [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedProductSearch(productSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [productSearch]);
  const r = useResource<{ products: Product[]; zones: Zone[] }>(
    `catalog?limit=50${debouncedProductSearch ? `&q=${encodeURIComponent(debouncedProductSearch)}` : ''}`,
  );
  const [lines, setLines] = useState<CartLine[]>([]),
    [done, setDone] = useState<{
      trackingUrl: string;
      reference: string;
    } | null>(null);
  const products = [
    ...selectedProducts,
    ...(r.data?.products || []).filter(
      (p) => !selectedProducts.some((selected) => selected.id === p.id),
    ),
  ];
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
          <div className="search-wrap">
            <Search />
            <input
              className="search-input"
              placeholder="Search product name or SKU"
              aria-label="Search products for order"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          <div className="manual-product-results">
            {r.data.products.map((p) => (
              <button
                className="manual-product"
                key={p.id}
                disabled={p.stock <= 0}
                onClick={() => {
                  setSelectedProducts((existing) =>
                    existing.some((item) => item.id === p.id)
                      ? existing
                      : [...existing, p],
                  );
                  setLines([
                    ...lines,
                    {
                      productId: p.id,
                      quantity: 1,
                      variant: JSON.parse(p.variants)[0]?.name || '',
                      custom: {},
                    },
                  ]);
                }}
              >
                <ProductImage src={p.image} name={p.name} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.sku} · {money(p.price)} · {p.stock} available
                  </small>
                </span>
              </button>
            ))}
          </div>
          {lines.map((l, i) => {
            const p = products.find((p) => p.id === l.productId)!;
            const max = Math.min(p.stock, 100);
            return (
              <div className="note-block form-stack" key={i}>
                <strong>{p.name}</strong>
                <Field label="Quantity">
                  <input
                    type="number"
                    min={1}
                    max={max}
                    value={l.quantity}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, n) =>
                          n === i
                            ? {
                                ...x,
                                quantity: Math.min(
                                  Math.max(1, Number(e.target.value)),
                                  max || 1,
                                ),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </Field>
                <small>Only {max} units available.</small>
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
            products={products}
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
