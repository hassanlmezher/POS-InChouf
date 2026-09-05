import { stmt, now, uid, type Runtime } from './db';
import { passwordHash, fail } from './security';
import { defaultSettings } from '../types';
export interface DemoCredentials {
  admin: string;
  owner: string;
  picker: string;
  driver: string;
}
export async function seedDemo(env: Runtime, passwords: DemoCredentials) {
  if (
    (await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{
      count: number;
    }>())!.count
  )
    fail(409, 'Bootstrap has already been completed.');
  const date = now(),
    tenantId = uid();
  // Hash sequentially to keep bootstrap below the Worker memory limit.
  const users: {id:string;key:keyof DemoCredentials;password:string}[]=[];
  for(const key of ['admin','owner','picker','driver'] as const){users.push({id:uid(),key,password:await passwordHash(passwords[key])})}
  const settings = {
    ...defaultSettings,
    tagline: 'Good things. A simpler way to shop.',
    description:
      'An internal InChouf demo collection. All products and orders are for testing only.',
    theme3d: true,
    categories: ['Audio', 'Everyday', 'Home', 'Personalized'],
  };
  await env.DB.batch([
    stmt(
      env.DB,
      'INSERT INTO tenants (id,name,slug,trialStart,trialEnd,settings,createdAt) VALUES (?,?,?,?,?,?,?)',
      tenantId,
      'InChouf Internal Demo',
      'internal-demo',
      date,
      new Date(Date.now() + 14 * 86400000).toISOString(),
      JSON.stringify(settings),
      date,
    ),
    ...users.map((u) =>
      stmt(
        env.DB,
        'INSERT INTO users (id,tenantId,email,name,role,password,createdAt) VALUES (?,?,?,?,?,?,?)',
        u.id,
        u.key === 'admin' ? null : tenantId,
        `${u.key}@demo.inchouf.test`,
        {
          admin: 'Platform Admin',
          owner: 'Demo Owner',
          picker: 'Demo Picker',
          driver: 'Demo Driver',
        }[u.key],
        {
          admin: 'super_admin',
          owner: 'owner',
          picker: 'picker',
          driver: 'delivery_manager',
        }[u.key],
        u.password,
        date,
      ),
    ),
    stmt(
      env.DB,
      'INSERT INTO zones (id,tenantId,name,fee,freeAbove,minimum,notes) VALUES (?,?,?,?,?,?,?)',
      uid(),
      tenantId,
      'Demo local delivery',
      300,
      10000,
      1000,
      'Internal demo · delivery in 1–2 days',
    ),
    stmt(
      env.DB,
      'INSERT INTO zones (id,tenantId,name,fee,minimum,notes) VALUES (?,?,?,?,?,?)',
      uid(),
      tenantId,
      'Demo extended delivery',
      600,
      2000,
      'Internal demo · delivery in 2–4 days',
    ),
    ...[
      [
        'Studio headphones',
        'Audio',
        'HP-001',
        7900,
        24,
        'headphones.jpg',
        'A comfortable listening companion for work and everyday listening.',
      ],
      [
        'Everyday tote',
        'Everyday',
        'BAG-001',
        2400,
        16,
        'tote.jpg',
        'A practical everyday bag with room for the essentials.',
      ],
      [
        'Ceramic mug',
        'Home',
        'MUG-001',
        1800,
        4,
        'mug.jpg',
        'A simple ceramic cup for your daily ritual.',
      ],
      [
        'Personalized notebook',
        'Personalized',
        'NOTE-001',
        2900,
        30,
        'notebook.jpg',
        'Add a name or a short message. Proof approval is available before packing.',
      ],
      [
        'Wireless speaker',
        'Audio',
        'SP-001',
        5900,
        9,
        'speaker.jpg',
        'Portable sound for your desk and your downtime.',
      ],
      [
        'Desk lamp',
        'Home',
        'LAMP-001',
        4900,
        12,
        'lamp.jpg',
        'A considered addition to your workspace.',
      ],
    ].map(([name, category, sku, price, stock, image, description], i) =>
      stmt(
        env.DB,
        'INSERT INTO products (id,tenantId,name,description,category,sku,price,stock,image,variants,customFields,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        uid(),
        tenantId,
        name,
        description,
        category,
        sku,
        price,
        stock,
        `/assets/${image}`,
        JSON.stringify(
          i === 0
            ? [
                { name: 'Charcoal', price: 7900, sku: 'HP-001-C' },
                { name: 'Sand', price: 7900, sku: 'HP-001-S' },
              ]
            : [],
        ),
        JSON.stringify(
          i === 3
            ? [
                { name: 'Name on cover', required: true, type: 'text' },
                { name: 'Artwork', required: false, type: 'file' },
              ]
            : [],
        ),
        date,
      ),
    ),
  ]);
  return { tenantId, users: users.map((u) => ({ id: u.id, key: u.key })) };
}
