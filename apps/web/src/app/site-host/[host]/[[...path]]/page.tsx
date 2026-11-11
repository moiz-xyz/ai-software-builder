import { LiveSite, siteMetadata } from '@/components/site/LiveSite';

export const dynamic = 'force-dynamic';

/** Reached via middleware rewrite for <slug>.ROOT_DOMAIN and verified custom domains. */
export async function generateMetadata({ params }: { params: Promise<{ host: string }> }) {
  return siteMetadata(`host=${encodeURIComponent((await params).host)}`);
}

export default async function HostSite({ params }: { params: Promise<{ host: string }> }) {
  return <LiveSite query={`host=${encodeURIComponent((await params).host)}`} />;
}
