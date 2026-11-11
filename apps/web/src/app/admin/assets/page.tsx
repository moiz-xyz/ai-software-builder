'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loading, PageHeader } from '@/components/ui/misc';
import { api, useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function Assets() {
  const { data, reload } = useApi<any[]>('/admin/assets');
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Uploaded assets" description="Latest 100 uploads across all customers. Staging uploads belong to unfinished requirement forms." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-lg border text-xs">
            <a href={a.url} target="_blank" rel="noreferrer">{a.mimeType.startsWith('image/') ? <img src={a.url} alt="" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-muted">PDF</div>}</a>
            <div className="space-y-0.5 p-2">
              <div className="truncate font-medium">{a.originalName}</div>
              <div className="truncate text-muted-foreground">{a.project ? <Link className="hover:underline" href={`/admin/projects/${a.projectId}`}>{a.project.name}</Link> : a.templateId ? 'Template asset' : 'Staging'} · {a.owner.email}</div>
              <div className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB · {fmtDate(a.createdAt)}</div>
              <Button size="xs" variant="ghost" className="px-0 text-destructive" onClick={async () => { if (confirm('Delete this file permanently?')) { await api(`/admin/assets/${a.id}`, { method: 'DELETE' }); reload(); } }}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
