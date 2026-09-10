'use client';
import { ErrorBox, Loading } from './shared';
import { useResource } from '@/lib/client';
import { settingsOf, type Product, type Tenant, type Zone } from '@/lib/types';
import { StorefrontTemplate } from './storefront-templates';

export default function Storefront({ slug }: { slug: string }) {
  const r = useResource<{ tenant: Tenant; products: Product[]; zones: Zone[] }>(
    `store/${slug}`,
  );

  if (r.loading) return <Loading />;
  if (r.error || !r.data)
    return (
      <main className="section">
        <h1>Store unavailable</h1>
        <ErrorBox error={r.error} retry={r.refresh} />
        <a className="button secondary" href="/">
          Back to InChouf
        </a>
      </main>
    );

  const { tenant, products, zones } = r.data;
  return (
    <StorefrontTemplate
      slug={slug}
      tenant={tenant}
      products={products}
      zones={zones}
      settings={settingsOf(tenant)}
      refresh={r.refresh}
    />
  );
}
