'use client';
import { useEffect, useState } from 'react';
import { SitePayload, SiteRenderer } from '@/components/site/SiteRenderer';
import { WorkspacePreview } from '@/components/site/WorkspacePreview';

/** Iframe body for the Instant Builder: renders whatever draft the parent page posts in. */
export default function BuilderFrame() {
  const [payload, setPayload] = useState<SitePayload | null>(null);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'sf:draft') setPayload(e.data.payload as SitePayload);
    };
    window.addEventListener('message', onMsg);
    window.parent?.postMessage({ type: 'sf:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  if (!payload) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: '#888', fontFamily: 'system-ui' }}>Preparing preview…</div>;
  if (payload.template.renderer === 'workspace') return <WorkspacePreview config={payload.config} theme={payload.theme} projectId={payload.project.id} name={payload.project.name} />;
  return <SiteRenderer payload={payload} />;
}
