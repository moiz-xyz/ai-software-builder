'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert, Loading } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';

/** Workspace users & roles (owner or roles with users:manage). */
export function Team({ projectId }: { projectId: string }) {
  const p = { id: projectId };
  const { data, reload } = useApi<{ members: any[]; roles: { key: string; name: string; permissions: string[] }[] }>(`/projects/${p.id}/members`);
  const [form, setForm] = useState({ email: '', name: '', roleKey: '' });
  const [result, setResult] = useState<{ tone: 'error' | 'success'; text: string }>();
  const add = async () => {
    try {
      const r = await api<{ tempPassword?: string }>(`/projects/${p.id}/members`, { method: 'POST', json: form });
      setResult({ tone: 'success', text: r.tempPassword ? `User created. Share this one-time password securely: ${r.tempPassword}` : 'Existing user added to the workspace.' });
      setForm({ email: '', name: '', roleKey: '' });
      reload();
    } catch (e) { setResult({ tone: 'error', text: (e as Error).message }); }
  };
  if (!data) return <Loading />;
  return (
    <div className="space-y-4">
      <Table>
        <THead><TR><TH>User</TH><TH>Role</TH><TH /></TR></THead>
        <TBody>
          {data.members.map((m) => (
            <TR key={m.id}>
              <TD>{m.user.name} <span className="text-muted-foreground">({m.user.email})</span></TD>
              <TD>
                <Select className="h-8 w-48" value={m.role.key} onChange={async (e) => { await api(`/projects/${p.id}/members/${m.id}`, { method: 'PATCH', json: { roleKey: e.target.value } }).catch((err) => alert(err.message)); reload(); }}>
                  {data.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                </Select>
              </TD>
              <TD className="text-right"><Button size="xs" variant="ghost" onClick={async () => { await api(`/projects/${p.id}/members/${m.id}`, { method: 'DELETE' }).catch((err) => alert(err.message)); reload(); }}>Remove</Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="grid max-w-3xl gap-3 sm:grid-cols-4">
        <Field label="Email" className="sm:col-span-2"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value })}>
            <option value="">Select…</option>
            {data.roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </Select>
        </Field>
      </div>
      <Button onClick={add} disabled={!form.email || !form.roleKey}>Add team member</Button>
      {result && <Alert tone={result.tone}>{result.text}</Alert>}
    </div>
  );
}

