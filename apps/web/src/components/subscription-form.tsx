'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert } from '@/components/ui/misc';
import { api } from '@/lib/api';

export function SubscriptionForm({ userId, sub, onSaved }: { userId: string; sub?: { plan: string; status: string; currentPeriodEnd?: string | null; notes?: string | null }; onSaved?: () => void }) {
  const [f, setF] = useState({ plan: sub?.plan ?? 'FREE', status: sub?.status ?? 'TRIALING', currentPeriodEnd: sub?.currentPeriodEnd?.slice(0, 10) ?? '', notes: sub?.notes ?? '' });
  const [msg, setMsg] = useState('');
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Plan"><Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>{['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].map((p) => <option key={p}>{p}</option>)}</Select></Field>
      <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED'].map((p) => <option key={p}>{p}</option>)}</Select></Field>
      <Field label="Period ends"><Input type="date" value={f.currentPeriodEnd} onChange={(e) => setF({ ...f, currentPeriodEnd: e.target.value })} /></Field>
      <Field label="Notes" className="sm:col-span-3"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="sm:col-span-3 flex items-center gap-3">
        <Button size="sm" onClick={async () => { await api(`/admin/subscriptions/${userId}`, { method: 'PUT', json: { ...f, currentPeriodEnd: f.currentPeriodEnd || null } }); setMsg('Saved.'); onSaved?.(); }}>Save subscription</Button>
        {msg && <Alert tone="success" className="py-1">{msg}</Alert>}
      </div>
    </div>
  );
}
