'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert, Badge, Loading, Modal, PageHeader, StatusBadge } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';

export default function AdminTemplates() {
  const router = useRouter();
  const { data, reload } = useApi<any[]>('/admin/templates');
  const [dup, setDup] = useState<any>(null);
  const [form, setForm] = useState({ key: '', name: '' });
  const [creating, setCreating] = useState(false);
  const [base, setBase] = useState('');
  const [error, setError] = useState('');
  if (!data) return <Loading />;

  async function duplicate(source: any) {
    setError('');
    try {
      const t = await api<{ id: string }>(`/admin/templates/${source.id}/duplicate`, { method: 'POST', json: form });
      router.push(`/admin/templates/${t.id}`);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <PageHeader title="Master templates" description="Customers always get a copy-on-create instance; editing a template never changes existing projects. Edits go to a draft until you publish a new version."
        actions={<Button onClick={() => { setCreating(true); setForm({ key: '', name: '' }); setError(''); }}>New template</Button>} />
      <Table>
        <THead><TR><TH>Template</TH><TH>Category</TH><TH>Status</TH><TH>Catalog version</TH><TH>Projects</TH><TH /></TR></THead>
        <TBody>
          {data.map((t) => (
            <TR key={t.id}>
              <TD><Link className="font-medium hover:underline" href={`/admin/templates/${t.id}`}>{t.name}</Link><div className="font-mono text-xs text-muted-foreground">{t.key}</div></TD>
              <TD><Badge>{t.category}</Badge></TD>
              <TD><StatusBadge status={t.status} /></TD>
              <TD>{t.currentVersion ? `v${t.currentVersion.version}` : '—'} <span className="text-xs text-muted-foreground">({t._count.versions} versions)</span></TD>
              <TD>{t._count.projects}</TD>
              <TD className="space-x-1 whitespace-nowrap text-right">
                <Button size="xs" variant="outline" onClick={() => { setDup(t); setForm({ key: `${t.key}-copy`, name: `${t.name} (copy)` }); setError(''); }}>Duplicate</Button>
                {t.status === 'PUBLISHED'
                  ? <Button size="xs" variant="ghost" onClick={async () => { await api(`/admin/templates/${t.id}/unpublish`, { method: 'POST' }); reload(); }}>Unpublish</Button>
                  : t.currentVersion && <Button size="xs" variant="ghost" onClick={async () => { await api(`/admin/templates/${t.id}/republish`, { method: 'POST' }); reload(); }}>Publish</Button>}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Modal open={!!dup || creating} onClose={() => { setDup(null); setCreating(false); }} title={dup ? `Duplicate ${dup.name}` : 'New template'}>
        <div className="space-y-4">
          {creating && (
            <Field label="Start from" help="New templates reuse an existing renderer & schema; adjust everything in the editor afterwards.">
              <Select value={base} onChange={(e) => setBase(e.target.value)}>
                <option value="">Select a base template…</option>
                {data.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
              </Select>
            </Field>
          )}
          <Field label="Key" help="Lowercase kebab-case, unique, cannot be changed later."><Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></Field>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          {error && <Alert tone="error">{error}</Alert>}
          <Button disabled={!form.key || (creating && !base)} onClick={() => duplicate(dup ?? { id: base })}>Create draft</Button>
        </div>
      </Modal>
    </>
  );
}
