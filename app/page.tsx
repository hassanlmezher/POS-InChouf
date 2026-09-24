import { headers } from 'next/headers';
import Storefront from '@/components/storefront';
import { publicStoreHost, publicStoreSlug } from '@/lib/server/security';

export default async function Home() {
  const host = (await headers()).get('host')?.toLowerCase().split(':')[0];
  if (host === publicStoreHost) return <Storefront slug={publicStoreSlug} />;

  return null;
}
