import { LiveSite, siteMetadata } from '@/components/site/LiveSite';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return siteMetadata(`slug=${encodeURIComponent((await params).slug)}`);
}

export default async function SlugSite({ params }: { params: Promise<{ slug: string }> }) {
  return <LiveSite query={`slug=${encodeURIComponent((await params).slug)}`} />;
}
