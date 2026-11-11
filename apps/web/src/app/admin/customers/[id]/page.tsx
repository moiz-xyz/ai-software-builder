'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SubscriptionForm } from '@/components/subscription-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Loading, PageHeader, StatusBadge } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function Customer() {
  const { id } = useParams<{ id: string }>();
  const { data: u, reload } = useApi<any>(`/admin/customers/${id}`);
  if (!u) return <Loading />;
  const setStatus = async (status: string) => { await api(`/admin/customers/${id}`, { method: 'PATCH', json: { status } }).catch((e) => alert(e.message)); reload(); };
  return (
    <>
      <PageHeader title={u.name} description={<span className="flex items-center gap-2">{u.email} {u.company && `· ${u.company}`} <StatusBadge status={u.status} /> <Badge tone={u.role === 'ADMIN' ? 'violet' : 'gray'}>{u.role}</Badge></span>}
        actions={u.status === 'ACTIVE' ? <Button variant="destructive" onClick={() => confirm('Suspend this account? They will be signed out of everything.') && setStatus('SUSPENDED')}>Suspend</Button> : <Button onClick={() => setStatus('ACTIVE')}>Reactivate</Button>} />
      <Card className="mb-5">
        <CardHeader><CardTitle className="text-base">Subscription · limits: {u.limits.maxProjects} projects, {u.limits.maxWorkspaceUsers} workspace users, custom domains {u.limits.customDomains ? 'yes' : 'no'}</CardTitle></CardHeader>
        <CardContent><SubscriptionForm userId={id} sub={u.subscription} onSaved={reload} /></CardContent>
      </Card>
      <h2 className="mb-2 font-semibold">Projects</h2>
      <Table>
        <THead><TR><TH>Project</TH><TH>Template</TH><TH>Status</TH><TH>Created</TH></TR></THead>
        <TBody>{u.projects.map((p: any) => <TR key={p.id}><TD><Link className="hover:underline" href={`/admin/projects/${p.id}`}>{p.name}</Link></TD><TD>{p.template.name}</TD><TD><StatusBadge status={p.status} /></TD><TD>{fmtDate(p.createdAt)}</TD></TR>)}</TBody>
      </Table>
      {u.memberships.length > 0 && <p className="mt-4 text-sm">Member of: {u.memberships.map((m: any) => `${m.project.name} (${m.role.name})`).join(', ')}</p>}
      <h2 className="mb-2 mt-6 font-semibold">Recent activity</h2>
      <div className="space-y-1 text-sm">{u.logs.map((l: any) => <div key={l.id} className="flex justify-between"><code>{l.action}</code><span className="text-muted-foreground">{fmtDate(l.createdAt)}</span></div>)}</div>
    </>
  );
}
