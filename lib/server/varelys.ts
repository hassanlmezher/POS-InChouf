import { type Database, now, one, stmt } from './db';
import { publicStoreSlug } from './security';
import { settingsOf, type Settings, type Tenant } from '../types';

const tenantId = 'tenant_varelysperfumes';

const storefront: Settings['storefront'] = {
  template: 'varelys-perfumes',
  theme: {
    accent: '#a87634',
    highlight: '#11100e',
    background: '#fbf8f2',
    heroBackground: '#f1e7d7',
    text: '#11100e',
    muted: '#6f675d',
    dim: '#9b9185',
    border: '#e9e0d2',
    cardBackground: '#f2eee7',
    cardBorder: '#e9e0d2',
  },
  sections: [
    {
      id: 'hero',
      type: 'hero',
      title: 'More Than A Fragrance A Feeling',
      description: 'Iconic scents. Unforgettable moments.',
    },
    { id: 'collection', type: 'categories', title: 'Shop' },
    { id: 'products', type: 'featuredProducts', title: 'Best Sellers' },
    {
      id: 'store-promise',
      type: 'banner',
      title: 'Fast delivery across Lebanon',
      description:
        'Your fragrance is prepared by Varelys and paid for by cash on delivery.',
    },
    { id: 'delivery', type: 'deliveryInfo', title: 'Delivery and support' },
  ],
};

const settings = (tenant?: Tenant): Settings => {
  const current = tenant ? settingsOf(tenant) : null;
  return {
    tagline: 'More Than A Fragrance A Feeling',
    description: 'Iconic scents. Unforgettable moments.',
    contactEmail: 'varelysperfumes@gmail.com',
    contactPhone: current?.contactPhone || '',
    address: current?.address || 'Lebanon',
    paymentOptions: ['Cash on delivery'],
    categories: [
      'Men',
      'Women',
      'Best Sellers',
      'New In',
      'Offers',
      'Fresh',
      'Woody',
      'Sweet',
      'Spicy',
    ],
    deliveryProviders: ['Varelys Delivery'],
    currency: 'USD',
    storefront,
  };
};

const products = [
  [
    'prod_amber_veil',
    'Amber Veil',
    'Warm amber, vanilla and soft woods with a polished evening finish.',
    'Best Sellers',
    'VP-AMB-50',
    2500,
    24,
    'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80',
    [
      { name: '50ml', price: 2500, sku: 'VP-AMB-50' },
      { name: '100ml', price: 4200, sku: 'VP-AMB-100' },
    ],
  ],
  [
    'prod_noir_oud',
    'Noir Oud',
    'Deep oud, smoked resin and dark spice for a confident signature.',
    'Men',
    'VP-OUD-50',
    2800,
    18,
    'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80',
    [
      { name: '50ml', price: 2800, sku: 'VP-OUD-50' },
      { name: '100ml', price: 4800, sku: 'VP-OUD-100' },
    ],
  ],
  [
    'prod_bloom_musk',
    'Bloom Musk',
    'White florals, clean musk and a creamy trail made for daily wear.',
    'Women',
    'VP-BLOOM-50',
    2400,
    22,
    'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=80',
    [
      { name: '50ml', price: 2400, sku: 'VP-BLOOM-50' },
      { name: '100ml', price: 3900, sku: 'VP-BLOOM-100' },
    ],
  ],
  [
    'prod_citrus_muse',
    'Citrus Muse',
    'Bright citrus, neroli and soft musk for a fresh daytime scent.',
    'Fresh',
    'VP-CIT-50',
    2200,
    30,
    'https://images.unsplash.com/photo-1563170351-be82bc888aa4?auto=format&fit=crop&w=900&q=80',
    [
      { name: '50ml', price: 2200, sku: 'VP-CIT-50' },
      { name: '100ml', price: 3600, sku: 'VP-CIT-100' },
    ],
  ],
  [
    'prod_velvet_tonka',
    'Velvet Tonka',
    'Sweet tonka, almond and vanilla with a smooth gourmand drydown.',
    'Sweet',
    'VP-TONKA-50',
    2600,
    20,
    'https://images.unsplash.com/photo-1587017539504-67cfbddac569?auto=format&fit=crop&w=900&q=80',
    [
      { name: '50ml', price: 2600, sku: 'VP-TONKA-50' },
      { name: '100ml', price: 4400, sku: 'VP-TONKA-100' },
    ],
  ],
] as const;

export async function ensureVarelysStore(db: Database) {
  const existing = await one<Tenant>(
    db,
    'SELECT * FROM tenants WHERE slug=?',
    publicStoreSlug,
  );
  const id = existing?.id || tenantId;
  const value = JSON.stringify(settings(existing || undefined));
  const createdAt = existing?.createdAt || now();

  if (existing) {
    await stmt(
      db,
      'UPDATE tenants SET name=?,active=1,subscription=?,plan=?,price=?,settings=?,suspendedDate=NULL WHERE id=?',
      'Varelys Perfumes',
      'active',
      'Varelys',
      0,
      value,
      id,
    ).run();
  } else {
    await stmt(
      db,
      'INSERT INTO tenants (id,name,slug,active,plan,price,subscription,settings,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
      id,
      'Varelys Perfumes',
      publicStoreSlug,
      1,
      'Varelys',
      0,
      'active',
      value,
      createdAt,
    ).run();
  }

  await db.batch([
    stmt(
      db,
      'INSERT INTO zones (id,tenantId,name,fee,freeAbove,minimum,active,notes) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (tenantId,id) DO UPDATE SET name=EXCLUDED.name,fee=EXCLUDED.fee,freeAbove=EXCLUDED.freeAbove,minimum=EXCLUDED.minimum,active=EXCLUDED.active,notes=EXCLUDED.notes',
      'zone_lebanon',
      id,
      'Lebanon',
      300,
      7500,
      0,
      1,
      'Fast delivery across Lebanon. Pay cash on delivery.',
    ),
    ...products.map((product) =>
      stmt(
        db,
        'INSERT INTO products (id,tenantId,name,description,category,sku,price,stock,lowStock,active,image,variants,customFields,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (tenantId,sku) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,category=EXCLUDED.category,price=EXCLUDED.price,stock=GREATEST(products.stock,EXCLUDED.stock),lowStock=EXCLUDED.lowStock,active=1,image=EXCLUDED.image,variants=EXCLUDED.variants,customFields=EXCLUDED.customFields',
        product[0],
        id,
        product[1],
        product[2],
        product[3],
        product[4],
        product[5],
        product[6],
        4,
        1,
        product[7],
        JSON.stringify(product[8]),
        '[]',
        createdAt,
      ),
    ),
  ]);
}
