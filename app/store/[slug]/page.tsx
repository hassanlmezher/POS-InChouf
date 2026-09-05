import Storefront from '@/components/storefront';
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <Storefront slug={slug} />;
}
