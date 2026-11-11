'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Input } from '@/components/ui/form';
import { Badge, Loading, PageHeader, StatusBadge } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function Customers() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data } = useApi<any[]>(`/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  return (
    <>
      <PageHeader title="Customers" />
      <form onSubmit={(e) => { e.preventDefault(); setQuery(q); }} className="mb-4"><Input className="max-w-xs" placeholder="Search email, name or company" value={q} onChange={(e) => setQ(e.target.value)} /></form>
      {!data ? <Loading /> : (
        <Table>
          <THead><TR><TH>User</TH><TH>Role</TH><TH>Status</TH><TH>Plan</TH><TH>Projects</TH><TH>Joined</TH></TR></THead>
          <TBody>
            {data.map((u) => (
              <TR key={u.id}>
                <TD><Link href={`/admin/customers/${u.id}`} className="font-medium hover:underline">{u.name}</Link><div className="text-xs text-muted-foreground">{u.email}{u.company && ` · ${u.company}`}</div></TD>
                <TD><Badge tone={u.role === 'ADMIN' ? 'violet' : 'gray'}>{u.role}</Badge></TD>
                <TD><StatusBadge status={u.status} /></TD>
                <TD>{u.subscription ? <>{u.subscription.plan} <StatusBadge status={u.subscription.status} /></> : '—'}</TD>
                <TD>{u._count.projects}</TD>
                <TD className="text-muted-foreground">{fmtDate(u.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
