'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loading, Modal, PageHeader, StatusBadge } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function Deployments() {
  const { data, reload } = useApi<any[]>('/admin/deployments');
  const [log, setLog] = useState<any>(null);
  useEffect(() => {
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [reload]);
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Deployment monitoring" description="Auto-refreshes every 5 seconds." />
      <Table>
        <THead><TR><TH>Project</TH><TH>Status</TH><TH>Config</TH><TH>Queued</TH><TH>Duration</TH><TH /></TR></THead>
        <TBody>
          {data.map((d) => (
            <TR key={d.id}>
              <TD><Link className="hover:underline" href={`/admin/projects/${d.project.id}`}>{d.project.name}</Link> <span className="text-xs text-muted-foreground">{d.project.category}</span></TD>
              <TD><StatusBadge status={d.status} /></TD>
              <TD>v{d.configVersion}</TD>
              <TD className="text-muted-foreground">{fmtDate(d.createdAt)}</TD>
              <TD>{d.startedAt && d.finishedAt ? `${((new Date(d.finishedAt).getTime() - new Date(d.startedAt).getTime()) / 1000).toFixed(1)}s` : '—'}</TD>
              <TD className="space-x-1 whitespace-nowrap text-right">
                <Button size="xs" variant="ghost" onClick={() => setLog(d)}>Log</Button>
                {d.status === 'FAILED' && <Button size="xs" variant="outline" onClick={async () => { await api(`/admin/deployments/${d.id}/retry`, { method: 'POST' }).catch((e) => alert(e.message)); reload(); }}>Retry</Button>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Modal open={!!log} onClose={() => setLog(null)} title="Deployment log" wide><pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{log?.log.join('\n')}</pre></Modal>
    </>
  );
}
