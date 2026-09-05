import Tracking from '@/components/tracking';
export default async function TrackingPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  return <Tracking slug={slug} token={token} />;
}
