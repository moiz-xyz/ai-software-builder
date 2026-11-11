'use client';
import type { ProjectConfig } from '@sf/templates';
import { useEffect, useState } from 'react';
import { SitePayload, SiteRenderer } from './SiteRenderer';
import { WorkspacePreview } from './WorkspacePreview';

/** Preview page body. In the editor iframe it re-renders on every config change via postMessage. */
export function LivePreview({ initial, token }: { initial: SitePayload; token: string }) {
  const [payload, setPayload] = useState(initial);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'sf:config') setPayload((p) => ({ ...p, config: e.data.config as ProjectConfig, theme: e.data.theme ?? p.theme }));
    };
    window.addEventListener('message', onMsg);
    window.parent?.postMessage({ type: 'sf:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  if (payload.template.renderer === 'workspace') return <WorkspacePreview config={payload.config} theme={payload.theme} projectId={payload.project.id} name={payload.project.name} />;
  return <SiteRenderer payload={payload} previewToken={token} />;
}
