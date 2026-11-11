'use client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Loading, PageHeader, StatusBadge } from '@/components/ui/misc';
import { useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function AdminHome() {
  const { data } = useApi<any>('/admin/stats');
  if (!data) return <Loading />;
  const tiles = [['Customers', data.customers], ['Projects', data.projects], ['Awaiting approval', data.awaitingApproval], ['Failed deployments', data.deploymentsFailed]];
  return (
    <>
      <PageHeader title="Platform overview" />
      {data.awaitingApproval > 0 && <Alert tone="warning" className="mb-4"><Link className="underline" href="/admin/projects?status=AWAITING_APPROVAL">{data.awaitingApproval} project(s) waiting for approval</Link></Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([l, v]) => <Card key={l}><CardContent className="pt-5"><div className="text-sm text-muted-foreground">{l}</div><div className="text-2xl font-semibold">{v}</div></CardContent></Card>)}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-base">Projects by status</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{Object.entries(data.projectsByStatus).map(([k, v]) => <div key={k} className="flex justify-between"><StatusBadge status={k} /><span>{v as number}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Projects by category</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{Object.entries(data.projectsByCategory).map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span>{v as number}</span></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">{Object.entries(data.templatesByStatus).map(([k, v]) => <div key={k} className="flex justify-between"><StatusBadge status={k} /><span>{v as number}</span></div>)}</CardContent></Card>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.recentActivity.map((l: any) => <div key={l.id} className="flex justify-between gap-4"><span><code>{l.action}</code> {l.actor?.email && <span className="text-muted-foreground">by {l.actor.email}</span>}</span><span className="text-muted-foreground">{fmtDate(l.createdAt)}</span></div>)}
        </CardContent>
      </Card>
    </>
  );
}
