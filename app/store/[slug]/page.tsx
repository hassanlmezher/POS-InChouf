import Storefront from '@/components/storefront';
import { publicStoreSlug } from '@/lib/server/security';

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug.toLowerCase() === publicStoreSlug) return null;
  return <Storefront slug={slug} />;
}
