'use client';
import { useState } from 'react';
import type { ThemeDef } from '@sf/templates';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Alert, Badge, Loading, Modal, PageHeader } from '@/components/ui/misc';
import { api, useApi } from '@/lib/api';

const COLORS = ['background', 'surface', 'text', 'muted', 'primary', 'secondary', 'accent'] as const;
const EMPTY: ThemeDef = { key: '', name: '', tokens: { background: '#ffffff', surface: '#f5f5f5', text: '#111111', muted: '#666666', primary: '#2563eb', secondary: '#eff6ff', accent: '#f59e0b', radius: '8px', heading: 'sans', dark: false } };

export default function Themes() {
  const { data, reload } = useApi<(ThemeDef & { builtIn: boolean })[]>('/admin/themes');
  const [edit, setEdit] = useState<{ theme: ThemeDef; isNew: boolean } | null>(null);
  const [error, setError] = useState('');
  if (!data) return <Loading />;
  const save = async () => {
    if (!edit) return;
    setError('');
    try {
      if (edit.isNew) await api('/admin/themes', { method: 'POST', json: edit.theme });
      else await api(`/admin/themes/${edit.theme.key}`, { method: 'PUT', json: edit.theme });
      setEdit(null);
      reload();
    } catch (e) { setError((e as Error).message); }
  };
  const t = edit?.theme;
  const setTok = (k: string, v: unknown) => edit && setEdit({ ...edit, theme: { ...edit.theme, tokens: { ...edit.theme.tokens, [k]: v } } });
  return (
    <>
      <PageHeader title="Theme library" description="Themes are referenced by templates; customers can only pick themes their template lists." actions={<Button onClick={() => setEdit({ theme: structuredClone(EMPTY), isNew: true })}>New theme</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((th) => (
          <button key={th.key} onClick={() => setEdit({ theme: structuredClone(th), isNew: false })} className="overflow-hidden rounded-lg border text-left hover:shadow-sm">
            <div className="flex h-16">{COLORS.map((c) => <div key={c} className="flex-1" style={{ background: th.tokens[c] }} />)}</div>
            <div className="flex items-center justify-between p-3"><span className="font-medium">{th.name}</span>{th.builtIn && <Badge tone="gray">built-in</Badge>}</div>
          </button>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'New theme' : `Edit ${t?.name}`} wide>
        {t && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Key"><Input value={t.key} disabled={!edit!.isNew} onChange={(e) => setEdit({ ...edit!, theme: { ...t, key: e.target.value.toLowerCase() } })} /></Field>
            <Field label="Name"><Input value={t.name} onChange={(e) => setEdit({ ...edit!, theme: { ...t, name: e.target.value } })} /></Field>
            {COLORS.map((c) => (
              <Field key={c} label={c}><div className="flex gap-2"><input type="color" value={t.tokens[c]} onChange={(e) => setTok(c, e.target.value)} className="h-10 w-12 rounded border" /><Input value={t.tokens[c]} onChange={(e) => setTok(c, e.target.value)} className="font-mono" /></div></Field>
            ))}
            <Field label="Corner radius"><Input value={t.tokens.radius} onChange={(e) => setTok('radius', e.target.value)} /></Field>
            <Field label="Heading style"><Select value={t.tokens.heading} onChange={(e) => setTok('heading', e.target.value)}><option>serif</option><option>sans</option><option>display</option><option>mono</option></Select></Field>
            {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={save}>Save</Button>
              {!edit!.isNew && <Button variant="ghost" onClick={async () => { try { await api(`/admin/themes/${t.key}`, { method: 'DELETE' }); setEdit(null); reload(); } catch (e) { setError((e as Error).message); } }}>Delete</Button>}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
