-- Run the project migrations first, then run this seed in the Supabase SQL editor.
-- Before running, replace __SUPABASE_AUTH_USER_ID__ with the auth.users id for
-- varelysperfumes@gmail.com. To avoid manual replacement, use:
-- VARELYS_ADMIN_PASSWORD='...' npm run varelys:setup

BEGIN;

INSERT INTO tenants (
  id,
  name,
  slug,
  active,
  plan,
  price,
  subscription,
  renewaldate,
  settings,
  createdat
) VALUES (
  'tenant_varelysperfumes',
  'Varelys Perfumes',
  'varelysperfumes',
  1,
  'Varelys',
  0,
  'active',
  NULL,
  $json$
  {
    "tagline": "More Than A Fragrance A Feeling",
    "description": "Iconic scents. Unforgettable moments.",
    "contactEmail": "varelysperfumes@gmail.com",
    "contactPhone": "",
    "address": "Lebanon",
    "paymentOptions": ["Cash on delivery"],
    "categories": ["Men", "Women", "Best Sellers", "New In", "Offers", "Fresh", "Woody", "Sweet", "Spicy"],
    "deliveryProviders": ["Varelys Delivery"],
    "currency": "USD",
    "storefront": {
      "template": "varelys-perfumes",
      "theme": {
        "accent": "#a87634",
        "highlight": "#11100e",
        "background": "#fbf8f2",
        "heroBackground": "#f1e7d7",
        "text": "#11100e",
        "muted": "#6f675d",
        "dim": "#9b9185",
        "border": "#e9e0d2",
        "cardBackground": "#f2eee7",
        "cardBorder": "#e9e0d2"
      },
      "sections": [
        {
          "id": "hero",
          "type": "hero",
          "title": "More Than A Fragrance A Feeling",
          "description": "Iconic scents. Unforgettable moments."
        },
        { "id": "collection", "type": "categories", "title": "Shop" },
        { "id": "products", "type": "featuredProducts", "title": "Best Sellers" },
        {
          "id": "store-promise",
          "type": "banner",
          "title": "Fast delivery across Lebanon",
          "description": "Your fragrance is prepared by Varelys and paid for by cash on delivery."
        },
        { "id": "delivery", "type": "deliveryInfo", "title": "Delivery and support" }
      ]
    }
  }
  $json$,
  now()::text
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  active = EXCLUDED.active,
  plan = EXCLUDED.plan,
  price = EXCLUDED.price,
  subscription = EXCLUDED.subscription,
  settings = EXCLUDED.settings;

INSERT INTO users (id, tenantid, email, name, role, active, createdat)
VALUES (
  '__SUPABASE_AUTH_USER_ID__',
  'tenant_varelysperfumes',
  'varelysperfumes@gmail.com',
  'Varelys Perfumes Admin',
  'owner',
  1,
  now()::text
) ON CONFLICT (id) DO UPDATE SET
  tenantid = EXCLUDED.tenantid,
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  active = EXCLUDED.active;

INSERT INTO zones (id, tenantid, name, fee, freeabove, minimum, active, notes)
VALUES
  ('zone_lebanon', 'tenant_varelysperfumes', 'Lebanon', 300, 7500, 0, 1, 'Fast delivery across Lebanon. Pay cash on delivery.')
ON CONFLICT (tenantid, id) DO UPDATE SET
  name = EXCLUDED.name,
  fee = EXCLUDED.fee,
  freeabove = EXCLUDED.freeabove,
  minimum = EXCLUDED.minimum,
  active = EXCLUDED.active,
  notes = EXCLUDED.notes;

INSERT INTO products (
  id,
  tenantid,
  name,
  description,
  category,
  sku,
  price,
  stock,
  lowstock,
  active,
  image,
  variants,
  customfields,
  createdat
) VALUES
  (
    'prod_amber_veil',
    'tenant_varelysperfumes',
    'Amber Veil',
    'Warm amber, vanilla and soft woods with a polished evening finish.',
    'Best Sellers',
    'VP-AMB-50',
    2500,
    24,
    4,
    1,
    'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80',
    '[{"name":"50ml","price":2500,"sku":"VP-AMB-50"},{"name":"100ml","price":4200,"sku":"VP-AMB-100"}]',
    '[]',
    now()::text
  ),
  (
    'prod_noir_oud',
    'tenant_varelysperfumes',
    'Noir Oud',
    'Deep oud, smoked resin and dark spice for a confident signature.',
    'Men',
    'VP-OUD-50',
    2800,
    18,
    4,
    1,
    'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=80',
    '[{"name":"50ml","price":2800,"sku":"VP-OUD-50"},{"name":"100ml","price":4800,"sku":"VP-OUD-100"}]',
    '[]',
    now()::text
  ),
  (
    'prod_bloom_musk',
    'tenant_varelysperfumes',
    'Bloom Musk',
    'White florals, clean musk and a creamy trail made for daily wear.',
    'Women',
    'VP-BLOOM-50',
    2400,
    22,
    4,
    1,
    'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=80',
    '[{"name":"50ml","price":2400,"sku":"VP-BLOOM-50"},{"name":"100ml","price":3900,"sku":"VP-BLOOM-100"}]',
    '[]',
    now()::text
  ),
  (
    'prod_citrus_muse',
    'tenant_varelysperfumes',
    'Citrus Muse',
    'Bright citrus, neroli and soft musk for a fresh daytime scent.',
    'Fresh',
    'VP-CIT-50',
    2200,
    30,
    5,
    1,
    'https://images.unsplash.com/photo-1563170351-be82bc888aa4?auto=format&fit=crop&w=900&q=80',
    '[{"name":"50ml","price":2200,"sku":"VP-CIT-50"},{"name":"100ml","price":3600,"sku":"VP-CIT-100"}]',
    '[]',
    now()::text
  ),
  (
    'prod_velvet_tonka',
    'tenant_varelysperfumes',
    'Velvet Tonka',
    'Sweet tonka, almond and vanilla with a smooth gourmand drydown.',
    'Sweet',
    'VP-TONKA-50',
    2600,
    20,
    4,
    1,
    'https://images.unsplash.com/photo-1587017539504-67cfbddac569?auto=format&fit=crop&w=900&q=80',
    '[{"name":"50ml","price":2600,"sku":"VP-TONKA-50"},{"name":"100ml","price":4400,"sku":"VP-TONKA-100"}]',
    '[]',
    now()::text
  )
ON CONFLICT (tenantid, sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  lowstock = EXCLUDED.lowstock,
  active = EXCLUDED.active,
  image = EXCLUDED.image,
  variants = EXCLUDED.variants,
  customfields = EXCLUDED.customfields;

COMMIT;
