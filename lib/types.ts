export type Role =
  | 'super_admin'
  | 'owner'
  | 'order_manager'
  | 'picker'
  | 'delivery_manager'
  | 'assistant';
export type Permission =
  | 'orders'
  | 'products'
  | 'delivery'
  | 'customers'
  | 'team'
  | 'settings'
  | 'analytics';
export const rolePermissions: Record<Role, Permission[]> = {
  super_admin: [],
  owner: [
    'orders',
    'products',
    'delivery',
    'customers',
    'team',
    'settings',
    'analytics',
  ],
  order_manager: ['orders', 'customers'],
  picker: ['orders'],
  delivery_manager: ['orders', 'delivery'],
  assistant: ['products'],
};
export const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  owner: 'Business Owner',
  order_manager: 'Order Manager',
  picker: 'Picker / Packer',
  delivery_manager: 'Delivery Manager',
  assistant: 'Store Assistant',
};
export const statuses = [
  'New',
  'Confirmed',
  'Picking',
  'Packed',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Returned',
  'Failed Delivery',
  'Needs Attention',
] as const;
export type Status = (typeof statuses)[number];
export const transitions: Record<Status, Status[]> = {
  New: ['Confirmed', 'Cancelled', 'Needs Attention'],
  Confirmed: ['Picking', 'Cancelled', 'Needs Attention'],
  Picking: ['Packed', 'Cancelled', 'Needs Attention'],
  Packed: ['Out for Delivery', 'Cancelled', 'Needs Attention'],
  'Out for Delivery': ['Delivered', 'Failed Delivery', 'Needs Attention'],
  Delivered: ['Returned'],
  Cancelled: [],
  Returned: [],
  'Failed Delivery': ['Out for Delivery', 'Returned', 'Needs Attention'],
  'Needs Attention': ['Confirmed', 'Cancelled'],
};
export interface User {
  id: string;
  tenantId: string | null;
  name: string;
  email: string;
  role: Role;
  active: number;
}
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  active: number;
  plan: string;
  price: number;
  subscription: string;
  trialStart: string | null;
  trialEnd: string | null;
  renewalDate: string | null;
  suspendedDate: string | null;
  settings: string;
  createdAt: string;
}
export interface Settings {
  tagline: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  paymentOptions: string[];
  categories: string[];
  currency: string;
  branding?: {
    logoId: string | null;
  };
}
export const defaultSettings: Settings = {
  tagline: 'Thoughtful finds. Delivered to you.',
  description: 'Explore our collection and order directly from our shop.',
  contactEmail: '',
  contactPhone: '',
  address: '',
  paymentOptions: ['Cash on delivery'],
  categories: ['General'],
  currency: 'USD',
};
export interface Variant {
  name: string;
  price: number;
  sku: string;
}
export interface CustomField {
  name: string;
  required: boolean;
  type: 'text';
}
export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  price: number;
  stock: number;
  lowStock: number;
  active: number;
  image: string;
  variants: string;
  customFields: string;
  createdAt: string;
}
export interface Zone {
  id: string;
  tenantId: string;
  name: string;
  fee: number;
  freeAbove: number | null;
  minimum: number;
  active: number;
  notes: string;
}
export interface Order {
  id: string;
  tenantId: string;
  reference: string;
  customer: string;
  phone: string;
  email: string;
  address: string;
  zoneId: string;
  status: Status;
  payment: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string;
  employeeId: string | null;
  driverId: string | null;
  deliveryMethod: 'internal_driver' | 'external_courier';
  deliveryProvider: string;
  deliveryStatus: string;
  cashCollected: number;
  reason: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Item {
  id: string;
  name: string;
  quantity: number;
  price: number;
  variant: string;
  custom: string;
}
export interface Event {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
  public: number;
}
export interface Settlement {
  id: string;
  tenantId: string;
  method: 'internal_driver' | 'external_courier';
  driverId: string | null;
  provider: string;
  periodStart: string | null;
  periodEnd: string | null;
  expected: number;
  actual: number;
  variance: number;
  status: 'balanced' | 'missing' | 'extra';
  createdBy: string;
  createdAt: string;
}
export interface Detail {
  order: Order;
  items: Item[];
  events: Event[];
}
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
export const settingsOf = (t: Tenant): Settings => {
  const stored = JSON.parse(t.settings) as Partial<Settings>;
  return {
    ...defaultSettings,
    tagline: stored.tagline ?? defaultSettings.tagline,
    description: stored.description ?? defaultSettings.description,
    contactEmail: stored.contactEmail ?? defaultSettings.contactEmail,
    contactPhone: stored.contactPhone ?? defaultSettings.contactPhone,
    address: stored.address ?? defaultSettings.address,
    paymentOptions: stored.paymentOptions ?? defaultSettings.paymentOptions,
    categories: stored.categories ?? defaultSettings.categories,
    currency: stored.currency ?? defaultSettings.currency,
    branding: stored.branding,
  };
};
