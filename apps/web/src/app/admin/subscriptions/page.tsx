'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SubscriptionForm } from '@/components/subscription-form';
import { Button } from '@/components/ui/button';
import { Loading, Modal, PageHeader, StatusBadge } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

export default function Subscriptions() {
  const { data, reload } = useApi<any[]>('/admin/subscriptions');
  const { data: plans } = useApi<Record<string, any>>('/admin/plans');
  const [edit, setEdit] = useState<any>(null);
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Subscriptions" description="Plans gate project count, workspace users and custom domains. Billing/payment collection is not connected yet — set plans manually here." />
      {plans && <div className="mb-4 grid gap-2 text-xs sm:grid-cols-4">{Object.entries(plans).map(([k, v]) => <div key={k} className="rounded border p-2"><strong>{k}</strong>: {v.maxProjects} projects · {v.maxWorkspaceUsers} users · domains {v.customDomains ? '✓' : '✗'}</div>)}</div>}
      <Table>
        <THead><TR><TH>Customer</TH><TH>Plan</TH><TH>Status</TH><TH>Period end</TH><TH>Projects</TH><TH /></TR></THead>
        <TBody>
          {data.map((s) => (
            <TR key={s.id}>
              <TD><Link className="hover:underline" href={`/admin/customers/${s.user.id}`}>{s.user.email}</Link></TD>
              <TD>{s.plan}</TD><TD><StatusBadge status={s.status} /></TD>
              <TD>{s.currentPeriodEnd ? fmtDate(s.currentPeriodEnd) : '—'}</TD>
              <TD>{s.user._count.projects}</TD>
              <TD className="text-right"><Button size="xs" variant="outline" onClick={() => setEdit(s)}>Edit</Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Subscription · ${edit?.user.email}`} wide>
        {edit && <SubscriptionForm userId={edit.user.id} sub={edit} onSaved={() => { reload(); setEdit(null); }} />}
      </Modal>
    </>
  );
}
