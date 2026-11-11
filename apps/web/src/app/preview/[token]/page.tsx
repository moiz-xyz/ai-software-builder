import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LivePreview } from '@/components/site/LivePreview';
import type { SitePayload } from '@/components/site/SiteRenderer';
import { serverApi } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { token } = await params;
  const { embed } = await searchParams;
  const payload = await serverApi<SitePayload>(`/public/preview/${encodeURIComponent(token)}`);
  if (!payload) notFound();
  return (
    <>
      {!embed && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#111827', color: '#fff', fontSize: 13, padding: '6px 12px', textAlign: 'center' }}>
          Preview of <strong>{payload.project.name}</strong> — not yet published
        </div>
      )}
      <LivePreview initial={payload} token={token} />
    </>
  );
}
