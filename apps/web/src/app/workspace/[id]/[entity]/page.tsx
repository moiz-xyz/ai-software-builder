'use client';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Kanban, List, Pencil, Plus, Trash2, UserCheck } from 'lucide-react';
import type { EntityField } from '@sf/templates';
import { useWorkspace } from '@/components/workspace-ctx';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Badge, EmptyState, Loading, Modal } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, useApi } from '@/lib/api';
import { money } from '@/lib/utils';

interface Rec { id: string; data: Record<string, unknown>; createdAt: string }
interface ListRes { total: number; page: number; pageSize: number; items: Rec[]; labels: Record<string, string> }

function RelationSelect({ projectId, field, value, onChange }: { projectId: string; field: EntityField; value: string; onChange: (v: string) => void }) {
  const meta = useWorkspace();
  const enabled = meta.entities.some((e) => e.key === field.relation && e.canRead);
  const { data } = useApi<{ value: string; label: string }[]>(enabled ? `/projects/${projectId}/workspace/options/${field.relation}` : null);
  if (!enabled) return <Input disabled placeholder="Module not enabled" />;
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={field.required}>
      <option value="">Select…</option>
      {data?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}

function RecordForm({ projectId, fields, initial, onSubmit, busy }: { projectId: string; fields: EntityField[]; initial: Record<string, unknown>; onSubmit: (d: Record<string, unknown>) => void; busy: boolean }) {
  const [data, setData] = useState<Record<string, unknown>>(() => {
    const d = { ...initial };
    for (const f of fields) if (d[f.key] === undefined && f.default !== undefined) d[f.key] = f.default;
    return d;
  });
  const set = (k: string, v: unknown) => setData((s) => ({ ...s, [k]: v }));
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(data); };
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const v = data[f.key];
        let input: React.ReactNode;
        switch (f.type) {
          case 'textarea': input = <Textarea value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required} />; break;
          case 'number': case 'money': input = <Input type="number" step={f.type === 'money' ? '0.01' : 'any'} value={v === null || v === undefined ? '' : String(v)} onChange={(e) => set(f.key, e.target.value === '' ? null : Number(e.target.value))} required={f.required} />; break;
          case 'date': input = <Input type="date" value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required} />; break;
          case 'boolean': input = <input type="checkbox" className="h-5 w-5" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} />; break;
          case 'select': input = <Select value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required}><option value="">Select…</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</Select>; break;
          case 'relation': input = <RelationSelect projectId={projectId} field={f} value={v as string} onChange={(x) => set(f.key, x)} />; break;
          default: input = <Input type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'} value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required} />;
        }
        return <Field key={f.key} label={f.label} required={f.required} className={f.type === 'textarea' ? 'sm:col-span-2' : undefined}>{input}</Field>;
      })}
      <div className="sm:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
    </form>
  );
}

export default function EntityPage() {
  const { id, entity: entityKey } = useParams<{ id: string; entity: string }>();
  const meta = useWorkspace();
  const entity = meta.entities.find((e) => e.key === entityKey);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useApi<ListRes>(entity ? `/projects/${id}/workspace/records/${entityKey}?page=${page}${query ? `&q=${encodeURIComponent(query)}` : ''}` : null);
  const [editing, setEditing] = useState<Rec | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canBoard = !!entity?.boardField && (entity.key !== 'deal' || meta.config.features.includes('pipelineBoard'));
  const [view, setView] = useState<'table' | 'board'>('table');
  useEffect(() => setView(canBoard && entityKey === 'deal' ? 'board' : 'table'), [canBoard, entityKey]);

  if (!entity) return <Alert tone="error">This module is not enabled.</Alert>;
  const currency = (meta.config.content.currency as string) || 'USD';
  const fieldOf = (k: string) => entity.fields.find((f) => f.key === k)!;
  const show = (f: EntityField, v: unknown, labels: Record<string, string>) => {
    if (v === null || v === undefined || v === '') return <span className="text-muted-foreground">—</span>;
    if (f.type === 'money') return money(v, currency);
    if (f.type === 'boolean') return v ? '✓' : '';
    if (f.type === 'relation') return labels[String(v)] ?? '—';
    if (f.type === 'select') return <Badge>{String(v)}</Badge>;
    return String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v);
  };

  async function save(d: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      if (editing === 'new') await api(`/projects/${id}/workspace/records/${entityKey}`, { method: 'POST', json: d });
      else if (editing) await api(`/projects/${id}/workspace/records/${entityKey}/${editing.id}`, { method: 'PATCH', json: d });
      setEditing(null);
      reload();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(r: Rec) {
    if (!confirm('Delete this record?')) return;
    try { await api(`/projects/${id}/workspace/records/${entityKey}/${r.id}`, { method: 'DELETE' }); reload(); }
    catch (e) { alert((e as Error).message); }
  }
  async function moveTo(r: Rec, value: string) {
    try { await api(`/projects/${id}/workspace/records/${entityKey}/${r.id}`, { method: 'PATCH', json: { [entity!.boardField!]: value } }); reload(); }
    catch (e) { alert((e as Error).message); }
  }
  async function convert(r: Rec) {
    try { await api(`/projects/${id}/workspace/leads/${r.id}/convert`, { method: 'POST', json: { createDeal: true } }); reload(); alert('Lead converted to a contact' + (meta.config.modules.includes('deals') ? ' and a deal.' : '.')); }
    catch (e) { alert((e as Error).message); }
  }

  const boardOptions = entity.boardField ? fieldOf(entity.boardField).options ?? [] : [];
  const canConvert = entity.key === 'lead' && meta.config.features.includes('leadConversion') && entity.canWrite;
  const immutable = entity.key === 'stockMovement';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{entity.plural}</h1>
        <div className="flex flex-wrap gap-2">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q); }} className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-48 bg-white" />
          </form>
          {canBoard && (
            <div className="inline-flex rounded-md border bg-white p-0.5">
              <button className={`rounded px-2 py-1 ${view === 'table' ? 'bg-muted' : ''}`} onClick={() => setView('table')} title="Table"><List className="h-4 w-4" /></button>
              <button className={`rounded px-2 py-1 ${view === 'board' ? 'bg-muted' : ''}`} onClick={() => setView('board')} title="Board"><Kanban className="h-4 w-4" /></button>
            </div>
          )}
          {entity.canWrite && <Button size="sm" onClick={() => { setError(''); setEditing('new'); }} style={{ background: meta.config.branding.primaryColor }}><Plus className="h-4 w-4" /> New {entity.label.toLowerCase()}</Button>}
        </div>
      </div>
      {immutable && <p className="text-sm text-muted-foreground">Stock movements adjust product quantities and cannot be edited. Record an ADJUST movement to correct stock.</p>}

      {loading && !data ? <Loading /> : !data?.items.length ? (
        <EmptyState title={query ? 'No matches' : `No ${entity.plural.toLowerCase()} yet`}>{entity.canWrite && !query && 'Create the first one with the button above.'}</EmptyState>
      ) : view === 'board' ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {boardOptions.map((col) => {
            const items = data.items.filter((r) => r.data[entity.boardField!] === col);
            return (
              <div key={col} className="w-64 shrink-0 rounded-lg bg-gray-100 p-2">
                <div className="mb-2 flex justify-between px-1 text-sm font-medium"><span>{col}</span><span className="text-muted-foreground">{items.length}</span></div>
                <div className="space-y-2">
                  {items.map((r) => (
                    <div key={r.id} className="rounded-md border bg-white p-3 text-sm shadow-sm">
                      <button className="text-left font-medium hover:underline" onClick={() => setEditing(r)}>{String(r.data[entity.displayField] ?? '—')}</button>
                      {entity.fields.filter((f) => f.type === 'money').slice(0, 1).map((f) => <div key={f.key} className="text-muted-foreground">{money(r.data[f.key], currency)}</div>)}
                      {entity.canWrite && (
                        <Select className="mt-2 h-7 text-xs" value={col} onChange={(e) => moveTo(r, e.target.value)}>
                          {boardOptions.map((o) => <option key={o}>{o}</option>)}
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <Table className="bg-white">
            <THead><TR>{entity.listColumns.map((c) => <TH key={c}>{fieldOf(c)?.label ?? c}</TH>)}<TH /></TR></THead>
            <TBody>
              {data.items.map((r) => (
                <TR key={r.id}>
                  {entity.listColumns.map((c) => <TD key={c}>{fieldOf(c) ? show(fieldOf(c), r.data[c], data.labels) : null}</TD>)}
                  <TD className="whitespace-nowrap text-right">
                    {canConvert && r.data.status !== 'Converted' && <Button size="xs" variant="outline" onClick={() => convert(r)} title="Convert lead"><UserCheck className="h-3.5 w-3.5" /> Convert</Button>}
                    {entity.canWrite && !immutable && <Button size="icon" variant="ghost" onClick={() => { setError(''); setEditing(r); }} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>}
                    {entity.canWrite && !immutable && <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.total} record{data.total === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `New ${entity.label.toLowerCase()}` : `Edit ${entity.label.toLowerCase()}`} wide>
        {error && <Alert tone="error" className="mb-4">{error}</Alert>}
        {editing && <RecordForm key={editing === 'new' ? 'new' : editing.id} projectId={id} fields={entity.fields} initial={editing === 'new' ? {} : editing.data} onSubmit={save} busy={busy} />}
      </Modal>
    </div>
  );
}
