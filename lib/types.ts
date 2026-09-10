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
  billingPhone?: string;
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
  deliveryProviders: string[];
  currency: string;
  branding?: {
    logoId: string | null;
  };
  storefront: StorefrontConfig;
}
export const storefrontTemplates = ['default', 'editorial', 'compact', 'custom'] as const;
export type StorefrontTemplate = (typeof storefrontTemplates)[number];
export const storefrontSectionTypes = [
  'hero',
  'categories',
  'featuredProducts',
  'banner',
  'deliveryInfo',
  'contact',
] as const;
export type StorefrontSectionType = (typeof storefrontSectionTypes)[number];
export interface StorefrontTheme {
  accent?: string;
  highlight?: string;
  background?: string;
  heroBackground?: string;
  text?: string;
  muted?: string;
  dim?: string;
  border?: string;
  cardBackground?: string;
  cardBorder?: string;
}
export interface StorefrontSection {
  id: string;
  type: StorefrontSectionType;
  enabled?: boolean;
  title?: string;
  description?: string;
  category?: string;
}
export interface StorefrontConfig {
  template: StorefrontTemplate;
  theme: StorefrontTheme;
  sections: StorefrontSection[];
}
export const defaultStorefrontSections: StorefrontSection[] = [
  { id: 'hero', type: 'hero' },
  { id: 'collection', type: 'categories' },
  { id: 'products', type: 'featuredProducts' },
  { id: 'store-promise', type: 'banner' },
  { id: 'delivery', type: 'deliveryInfo' },
];
export const defaultStorefrontConfig: StorefrontConfig = {
  template: 'default',
  theme: {},
  sections: defaultStorefrontSections,
};
const isStorefrontTemplate = (value: unknown): value is StorefrontTemplate =>
  typeof value === 'string' &&
  storefrontTemplates.includes(value as StorefrontTemplate);
const isStorefrontSectionType = (
  value: unknown,
): value is StorefrontSectionType =>
  typeof value === 'string' &&
  storefrontSectionTypes.includes(value as StorefrontSectionType);
const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const storefrontThemeOf = (value: unknown): StorefrontTheme => {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<keyof StorefrontTheme, unknown>;
  return Object.fromEntries(
    ([
      'accent',
      'highlight',
      'background',
      'heroBackground',
      'text',
      'muted',
      'dim',
      'border',
      'cardBackground',
      'cardBorder',
    ] as const)
      .map((key) => [key, input[key]])
      .filter((entry): entry is [keyof StorefrontTheme, string] =>
        isHexColor(entry[1]),
      ),
  );
};
const storefrontSectionsOf = (value: unknown): StorefrontSection[] => {
  if (!Array.isArray(value)) return defaultStorefrontConfig.sections;
  const sections = value
    .map((section, index): StorefrontSection | null => {
      if (!section || typeof section !== 'object') return null;
      const input = section as Record<string, unknown>;
      if (!isStorefrontSectionType(input.type)) return null;
      const id = typeof input.id === 'string' && input.id ? input.id : input.type;
      const normalized: StorefrontSection = {
        id: id.slice(0, 80) || `${input.type}-${index + 1}`,
        type: input.type,
      };
      if (typeof input.enabled === 'boolean') normalized.enabled = input.enabled;
      if (typeof input.title === 'string')
        normalized.title = input.title.slice(0, 150);
      if (typeof input.description === 'string')
        normalized.description = input.description.slice(0, 2000);
      if (typeof input.category === 'string')
        normalized.category = input.category.slice(0, 80);
      return normalized;
    })
    .filter((section): section is StorefrontSection => Boolean(section));
  return sections.length ? sections : defaultStorefrontConfig.sections;
};
export const defaultSettings: Settings = {
  tagline: 'Thoughtful finds. Delivered to you.',
  description: 'Explore our collection and order directly from our shop.',
  contactEmail: '',
  contactPhone: '',
  address: '',
  paymentOptions: ['Cash on delivery'],
  categories: ['General'],
  deliveryProviders: [],
  currency: 'USD',
  storefront: defaultStorefrontConfig,
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
  discountPercent: number;
  discountAmount: number;
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
export interface SettlementTarget {
  method: 'internal_driver' | 'external_courier';
  driverId: string | null;
  provider: string;
  label: string;
  expected: number;
  count: number;
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
  const storedStorefront =
    stored.storefront && typeof stored.storefront === 'object'
      ? (stored.storefront as Partial<StorefrontConfig>)
      : defaultStorefrontConfig;
  return {
    ...defaultSettings,
    tagline: stored.tagline ?? defaultSettings.tagline,
    description: stored.description ?? defaultSettings.description,
    contactEmail: stored.contactEmail ?? defaultSettings.contactEmail,
    contactPhone: stored.contactPhone ?? defaultSettings.contactPhone,
    address: stored.address ?? defaultSettings.address,
    paymentOptions: stored.paymentOptions ?? defaultSettings.paymentOptions,
    categories: stored.categories ?? defaultSettings.categories,
    deliveryProviders:
      stored.deliveryProviders ?? defaultSettings.deliveryProviders,
    currency: stored.currency ?? defaultSettings.currency,
    branding: stored.branding,
    storefront: {
      template: isStorefrontTemplate(storedStorefront.template)
        ? storedStorefront.template
        : defaultStorefrontConfig.template,
      theme: storefrontThemeOf(storedStorefront.theme),
      sections: storefrontSectionsOf(storedStorefront.sections),
    },
  };
};
