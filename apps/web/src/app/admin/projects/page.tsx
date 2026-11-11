'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Input, Select } from '@/components/ui/form';
import { Badge, Loading, PageHeader, StatusBadge } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

const STATUSES = ['PREVIEW_READY', 'AWAITING_APPROVAL', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'UNPUBLISHED', 'REJECTED'];

function ProjectsList() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get('status') ?? '';
  const category = params.get('category') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  const qs = new URLSearchParams({ ...(status && { status }), ...(category && { category }), ...(params.get('q') && { q: params.get('q')! }) });
  const { data } = useApi<any[]>(`/admin/projects?${qs}`);
  const go = (patch: Record<string, string>) => {
    const n = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) v ? n.set(k, v) : n.delete(k);
    router.push(`/admin/projects?${n}`);
  };
  return (
    <>
      <PageHeader title="Customer projects" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-48" value={status} onChange={(e) => go({ status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
        <Select className="w-40" value={category} onChange={(e) => go({ category: e.target.value })}><option value="">All categories</option><option>WEBSITE</option><option>CRM</option><option>ERP</option></Select>
        <form onSubmit={(e) => { e.preventDefault(); go({ q }); }}><Input className="w-56" placeholder="Search name or subdomain" value={q} onChange={(e) => setQ(e.target.value)} /></form>
      </div>
      {!data ? <Loading /> : (
        <Table>
          <THead><TR><TH>Project</TH><TH>Customer</TH><TH>Template</TH><TH>Status</TH><TH>Updated</TH></TR></THead>
          <TBody>
            {data.map((p) => (
              <TR key={p.id}>
                <TD><Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link><div className="font-mono text-xs text-muted-foreground">{p.slug}</div></TD>
                <TD><Link href={`/admin/customers/${p.owner.id}`} className="hover:underline">{p.owner.email}</Link></TD>
                <TD><Badge>{p.category}</Badge> {p.template.name} <span className="text-xs text-muted-foreground">v{p.templateVersion.version}</span></TD>
                <TD><StatusBadge status={p.status} /></TD>
                <TD className="text-muted-foreground">{fmtDate(p.updatedAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Loading />}><ProjectsList /></Suspense>;
}
