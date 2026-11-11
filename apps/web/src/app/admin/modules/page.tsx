'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Badge, Loading, Modal, PageHeader } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';

export default function Modules() {
  const { data, reload } = useApi<any[]>('/admin/modules');
  const [edit, setEdit] = useState<any>(null);
  const [entities, setEntities] = useState('');
  const [error, setError] = useState('');
  if (!data) return <Loading />;
  const open = (m: any, isNew = false) => { setEdit({ ...m, isNew }); setEntities(JSON.stringify(m.entities, null, 2)); setError(''); };
  const save = async () => {
    setError('');
    try {
      const body = { key: edit.key, name: edit.name, category: edit.category, description: edit.description, active: edit.active, entities: JSON.parse(entities) };
      if (edit.isNew) await api('/admin/modules', { method: 'POST', json: body });
      else await api(`/admin/modules/${edit.key}`, { method: 'PUT', json: body });
      setEdit(null);
      reload();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Module library" description="Modules define the business entities (fields, list columns, boards) available to CRM/ERP templates. Projects keep working records per project."
        actions={<Button onClick={() => open({ key: '', name: '', category: 'CRM', description: '', active: true, entities: [{ key: 'item', label: 'Item', plural: 'Items', displayField: 'name', listColumns: ['name'], fields: [{ key: 'name', label: 'Name', type: 'text', required: true }] }] }, true)}>New module</Button>} />
      <Table>
        <THead><TR><TH>Module</TH><TH>Category</TH><TH>Entities</TH><TH>Status</TH><TH /></TR></THead>
        <TBody>
          {data.map((m) => (
            <TR key={m.key}>
              <TD><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.description}</div></TD>
              <TD><Badge>{m.category}</Badge></TD>
              <TD className="text-sm">{m.entities.map((e: any) => e.plural).join(', ')}</TD>
              <TD>{m.active ? <Badge tone="green">active</Badge> : <Badge tone="gray">inactive</Badge>} {m.builtIn && <Badge tone="gray">built-in</Badge>}</TD>
              <TD className="text-right"><Button size="xs" variant="outline" onClick={() => open(m)}>Edit</Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'New module' : `Edit ${edit?.name}`} wide>
        {edit && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Key"><Input value={edit.key} disabled={!edit.isNew} onChange={(e) => setEdit({ ...edit, key: e.target.value.toLowerCase() })} /></Field>
              <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Category"><Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}><option>CRM</option><option>ERP</option><option>WEBSITE</option></Select></Field>
            </div>
            <Field label="Description"><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            {!edit.isNew && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label>}
            <Field label="Entities (JSON)" help="Field types: text, textarea, email, phone, number, money, date, select, boolean, relation."><Textarea className="min-h-[320px] font-mono text-xs" value={entities} onChange={(e) => setEntities(e.target.value)} /></Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button onClick={save}>Save</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
