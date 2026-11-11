'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Loading, PageHeader } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function Audit() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), ...(entityType && { entityType }), ...(action && { action }) });
  const { data } = useApi<any[]>(`/admin/audit-logs?${qs}`);
  return (
    <>
      <PageHeader title="Audit log" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-40" value={entityType} onChange={(e) => { setPage(1); setEntityType(e.target.value); }}><option value="">All entities</option>{['Project', 'Template', 'User', 'Theme', 'Module', 'Asset'].map((x) => <option key={x}>{x}</option>)}</Select>
        <Input className="w-56" placeholder="Action contains…" value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} />
      </div>
      {!data ? <Loading /> : (
        <>
          <Table>
            <THead><TR><TH>When</TH><TH>Action</TH><TH>Actor</TH><TH>Entity</TH><TH>Details</TH></TR></THead>
            <TBody>
              {data.map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</TD>
                  <TD><code>{l.action}</code></TD>
                  <TD>{l.actor?.email ?? <span className="text-muted-foreground">visitor/system</span>}</TD>
                  <TD className="text-xs">{l.entityType} <span className="font-mono text-muted-foreground">{l.entityId}</span></TD>
                  <TD className="max-w-sm truncate font-mono text-xs">{l.meta ? JSON.stringify(l.meta) : ''}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={data.length < 100} onClick={() => setPage(page + 1)}>Next</Button></div>
        </>
      )}
    </>
  );
}
