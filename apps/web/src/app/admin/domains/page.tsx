'use client';
import Link from 'next/link';
import { Select } from '@/components/ui/form';
import { Badge, Loading, PageHeader } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';

export default function Domains() {
  const { data, reload } = useApi<any[]>('/admin/domains');
  if (!data) return <Loading />;
  const patch = async (id: string, body: Record<string, unknown>) => { await api(`/admin/domains/${id}`, { method: 'PATCH', json: body }); reload(); };
  return (
    <>
      <PageHeader title="Domains & SSL" description="Platform subdomains use the wildcard certificate. Custom domains are verified via DNS TXT and get certificates from infra/scripts/issue-certs.sh." />
      <Table>
        <THead><TR><TH>Hostname</TH><TH>Project</TH><TH>Type</TH><TH>DNS</TH><TH>SSL</TH></TR></THead>
        <TBody>
          {data.map((d) => (
            <TR key={d.id}>
              <TD className="font-mono text-xs">{d.hostname}</TD>
              <TD><Link className="hover:underline" href={`/admin/projects/${d.project.id}`}>{d.project.name}</Link></TD>
              <TD><Badge>{d.type}</Badge></TD>
              <TD>{d.type === 'CUSTOM' ? <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={d.verified} onChange={(e) => patch(d.id, { verified: e.target.checked })} /> verified</label> : 'platform'}</TD>
              <TD><Select className="h-8 w-32" value={d.sslStatus} onChange={(e) => patch(d.id, { sslStatus: e.target.value })}><option>PENDING</option><option>ACTIVE</option><option>FAILED</option></Select></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </>
  );
}
