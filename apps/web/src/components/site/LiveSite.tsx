import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/server';
import { SitePayload, SiteRenderer } from './SiteRenderer';
import { WorkspacePreview } from './WorkspacePreview';

export async function LiveSite({ query }: { query: string }) {
  const payload = await serverApi<SitePayload>(`/public/sites/resolve?${query}`);
  if (!payload) notFound();
  if (payload.template.renderer === 'workspace') return <WorkspacePreview config={payload.config} theme={payload.theme} projectId={payload.project.id} name={payload.project.name} />;
  return <SiteRenderer payload={payload} />;
}

export async function siteMetadata(query: string) {
  const payload = await serverApi<SitePayload>(`/public/sites/resolve?${query}`).catch(() => null);
  if (!payload) return { title: 'Site not found' };
  return { title: payload.config.business.name, description: payload.config.business.tagline || payload.config.business.description?.slice(0, 160) };
}
