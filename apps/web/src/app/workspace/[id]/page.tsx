'use client';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Loading } from '@/components/ui/misc';
import { useApi } from '@/lib/api';
import { money } from '@/lib/utils';
import { useWorkspace } from '@/components/workspace-ctx';

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="pt-5"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>
  );
}

function Bars({ title, data, fmt }: { title: string; data: Record<string, number>; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...Object.values(data));
  const meta = useWorkspace();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {Object.keys(data).length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="text-sm">
            <div className="flex justify-between"><span>{k}</span><span className="tabular-nums text-muted-foreground">{fmt ? fmt(v) : v}</span></div>
            <div className="mt-1 h-2 rounded bg-gray-200"><div className="h-2 rounded" style={{ width: `${(v / max) * 100}%`, background: meta.config.branding.primaryColor }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function WorkspaceDashboard() {
  const { id } = useParams<{ id: string }>();
  const meta = useWorkspace();
  const { data: d } = useApi<any>(`/projects/${id}/workspace/dashboard`);
  if (!d) return <Loading />;
  const cur = d.currency as string;
  const m = (n: number) => money(n, cur);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(d.counts as Record<string, number>).map(([k, v]) => <Stat key={k} label={k} value={v} />)}
      </div>
      {d.inventory?.lowStock?.length > 0 && (
        <Alert tone="warning">
          <strong>Low stock:</strong> {d.inventory.lowStock.map((p: any) => `${p.name} (${p.quantity} left, reorder at ${p.reorderLevel})`).join(' · ')}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.pipeline && <><Stat label="Open pipeline" value={m(d.pipeline.openValue)} /><Stat label="Won" value={m(d.pipeline.wonValue)} /></>}
        {d.tasks && <><Stat label="Open tasks" value={d.tasks.open} /><Stat label="Overdue tasks" value={d.tasks.overdue} /></>}
        {d.inventory && <Stat label="Stock value (cost)" value={m(d.inventory.stockValue)} />}
        {d.sales && <Stat label="Sales fulfilled" value={m(d.sales.fulfilledTotal)} />}
        {d.purchases && <Stat label="Purchases received" value={m(d.purchases.receivedTotal)} />}
        {d.accounting && <><Stat label="Outstanding invoices" value={m(d.accounting.outstanding)} /><Stat label="Paid invoices" value={m(d.accounting.paid)} /><Stat label="Expenses" value={m(d.accounting.expenses)} /></>}
        {d.hr && <><Stat label="Active employees" value={d.hr.active} /><Stat label="Monthly payroll" value={m(d.hr.payroll)} /></>}
        {d.reservations && <Stat label="Upcoming reservations" value={d.reservations.upcoming} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {d.pipeline && <Bars title="Deal value by stage" data={d.pipeline.valueByStage} fmt={m} />}
        {d.leads && <Bars title="Leads by status" data={d.leads.byStatus} />}
        {d.leads && <Bars title="Leads by source" data={d.leads.bySource} />}
        {d.sales && <Bars title="Sales orders by status" data={d.sales.byStatus} />}
        {d.purchases && <Bars title="Purchase orders by status" data={d.purchases.byStatus} />}
        {d.hr && <Bars title="Employees by department" data={d.hr.byDepartment} />}
      </div>
      {meta.entities.length === 0 && <Alert tone="info">No modules are enabled for your role.</Alert>}
    </div>
  );
}
