'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { baseConfig, TemplateDefinition, ThemeDef, validateTemplateDefinition, ValidationIssue } from '@sf/templates';
import { SiteRenderer } from '@/components/site/SiteRenderer';
import { WorkspacePreview } from '@/components/site/WorkspacePreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, Badge, JsonView, Loading, Modal, PageHeader, StatusBadge, Tabs } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api, ApiError, upload, useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

const JSON_PARTS = ['features', 'sections', 'layoutVariants', 'formSchema', 'defaults', 'roles'] as const;

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const { data: t, reload } = useApi<any>(`/admin/templates/${id}`);
  const { data: themes } = useApi<{ key: string; name: string; tokens: ThemeDef['tokens'] }[]>('/admin/themes');
  const { data: modules } = useApi<{ key: string; name: string; category: string }[]>('/admin/modules');
  const [draft, setDraft] = useState<TemplateDefinition | null>(null);
  const [jsonText, setJsonText] = useState<Record<string, string>>({});
  const [tab, setTab] = useState('general');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string }>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [bump, setBump] = useState<'major' | 'minor' | 'patch'>('minor');
  const [changelog, setChangelog] = useState('');
  const [viewVersion, setViewVersion] = useState<any>(null);

  useEffect(() => {
    if (!t) return;
    setDraft(t.draft);
    setJsonText(Object.fromEntries(JSON_PARTS.map((k) => [k, JSON.stringify(t.draft[k], null, 2)])));
  }, [t]);

  /** Merge JSON tabs into the draft (returns null + error if a tab has invalid JSON). */
  const merged = useMemo(() => {
    if (!draft) return null;
    try {
      const out = { ...draft } as Record<string, unknown>;
      for (const k of JSON_PARTS) out[k] = JSON.parse(jsonText[k] ?? 'null');
      return out as unknown as TemplateDefinition;
    } catch {
      return null;
    }
  }, [draft, jsonText]);
  const ctx = useMemo(() => ({ themes: themes?.map((x) => ({ key: x.key, name: x.name, tokens: x.tokens })) ?? [] }), [themes]);
  const local = useMemo(() => (merged ? validateTemplateDefinition(merged, ctx) : null), [merged, ctx]);

  if (!t || !draft || !themes || !modules) return <Loading />;
  const set = (patch: Partial<TemplateDefinition>) => setDraft({ ...draft, ...patch });

  async function save() {
    setMsg(undefined);
    setIssues([]);
    if (!merged) return setMsg({ tone: 'error', text: 'One of the JSON tabs contains invalid JSON.' });
    try {
      await api(`/admin/templates/${id}`, { method: 'PUT', json: merged });
      setMsg({ tone: 'success', text: 'Draft saved. Existing customer projects are not affected; publish a new version to update the catalog.' });
      reload();
    } catch (e) {
      setIssues((e as ApiError).issues);
      setMsg({ tone: 'error', text: (e as Error).message });
    }
  }
  async function publish() {
    try {
      await api(`/admin/templates/${id}/publish`, { method: 'POST', json: { bump, changelog } });
      setPublishOpen(false);
      setChangelog('');
      setMsg({ tone: 'success', text: 'New version published to the catalog.' });
      reload();
    } catch (e) {
      setIssues((e as ApiError).issues);
      setMsg({ tone: 'error', text: (e as Error).message });
      setPublishOpen(false);
    }
  }
  const action = async (path: string, text: string) => {
    try { await api(`/admin/templates/${id}${path}`, { method: 'POST' }); setMsg({ tone: 'success', text }); reload(); }
    catch (e) { setMsg({ tone: 'error', text: (e as Error).message }); }
  };

  const sample = merged && local?.valid ? baseConfig(merged, ctx) : null;
  const sampleTheme = sample ? ctx.themes.find((x) => x.key === sample.branding.theme) ?? ctx.themes[0] : null;
  const catModules = modules.filter((m) => m.category === draft.category || (draft.category === 'WEBSITE' && m.category === 'WEBSITE'));
  const allIssues = issues.length ? issues : local?.errors ?? [];

  return (
    <>
      <Link href="/admin/templates" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Templates</Link>
      <PageHeader
        title={t.name}
        description={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={t.status} /> <code>{t.key}</code> · catalog {t.currentVersion ? `v${t.currentVersion.version}` : 'unpublished'} · used by {t._count.projects} project(s) · draft edited {fmtDate(t.draftUpdatedAt)}</span>}
        actions={
          <>
            <Button variant="outline" onClick={save}>Save draft</Button>
            <Button onClick={() => setPublishOpen(true)} disabled={!local?.valid}>Publish new version</Button>
            {t.status === 'PUBLISHED' && <Button variant="ghost" onClick={() => action('/unpublish', 'Removed from the catalog.')}>Unpublish</Button>}
            {t.status !== 'PUBLISHED' && t.currentVersion && <Button variant="ghost" onClick={() => action('/republish', 'Back in the catalog.')}>Re-publish</Button>}
            {t.status !== 'ARCHIVED' && <Button variant="ghost" onClick={() => action('/archive', 'Archived.')}>Archive</Button>}
          </>
        }
      />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      {allIssues.length > 0 && <Alert tone="warning" className="mb-4"><ul className="list-disc pl-4">{allIssues.map((i, k) => <li key={k}><code>{i.path}</code> {i.message}</li>)}</ul></Alert>}

      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'general', label: 'General' }, ...JSON_PARTS.map((k) => ({ key: k, label: k })), { key: 'preview', label: 'Preview' }, { key: 'versions', label: `Versions (${t.versions.length})` }]} />
      <div className="mt-5">
        {tab === 'general' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Name"><Input value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Description"><Textarea value={draft.description} onChange={(e) => set({ description: e.target.value })} /></Field>
                <Field label="Renderer" help="Code-implemented design used to render this template. Category and key are fixed.">
                  <Input value={`${draft.category} · ${draft.renderer}`} disabled />
                </Field>
                <Field label="Preview images">
                  <div className="flex flex-wrap gap-2">
                    {draft.previewImages.map((src, i) => (
                      <div key={src} className="relative">
                        <img src={src} alt="" className="h-20 w-32 rounded border object-cover" />
                        <button onClick={() => set({ previewImages: draft.previewImages.filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white" aria-label="Remove"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <label className="flex h-20 w-32 cursor-pointer items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const a = await upload(f, { templateId: id });
                        set({ previewImages: [...draft.previewImages, a.url] });
                      }} />
                    </label>
                  </div>
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Themes, fonts & modules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Available themes">
                  <div className="flex flex-wrap gap-2">
                    {themes.map((th) => {
                      const on = draft.themes.includes(th.key);
                      return (
                        <button key={th.key} type="button" onClick={() => set({ themes: on ? draft.themes.filter((x) => x !== th.key) : [...draft.themes, th.key] })} className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${on ? 'bg-primary text-primary-foreground' : ''}`}>
                          <span className="h-3 w-3 rounded-full" style={{ background: th.tokens.primary }} /> {th.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Default theme">
                  <Select value={draft.defaultTheme} onChange={(e) => set({ defaultTheme: e.target.value })}>{draft.themes.map((k) => <option key={k}>{k}</option>)}</Select>
                </Field>
                <Field label="Fonts (comma separated)"><Input value={draft.fonts.join(', ')} onChange={(e) => set({ fonts: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
                <Field label={draft.category === 'WEBSITE' ? 'Data modules (website forms)' : 'Supported modules'}>
                  <div className="space-y-1">
                    {catModules.map((m) => {
                      const on = draft.modules.includes(m.key);
                      const req = draft.requiredModules?.includes(m.key);
                      return (
                        <div key={m.key} className="flex items-center gap-3 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={on} onChange={() => set({ modules: on ? draft.modules.filter((x) => x !== m.key) : [...draft.modules, m.key], requiredModules: on ? draft.requiredModules?.filter((x) => x !== m.key) : draft.requiredModules })} /> {m.name}</label>
                          {on && draft.category !== 'WEBSITE' && <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={!!req} onChange={() => set({ requiredModules: req ? draft.requiredModules?.filter((x) => x !== m.key) : [...(draft.requiredModules ?? []), m.key] })} /> required</label>}
                        </div>
                      );
                    })}
                  </div>
                </Field>
              </CardContent>
            </Card>
          </div>
        )}

        {JSON_PARTS.includes(tab as (typeof JSON_PARTS)[number]) && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {tab === 'formSchema' && 'Requirement form sections & fields. Each field binds to a config path (e.g. business.name, content.menu). Field types: text, textarea, email, phone, url, number, select, multiselect, checkbox, color, image, images, repeater, list, hours, theme, layout, font, features, modules, roles.'}
              {tab === 'features' && 'Supported features. "requires" lists dependencies; "section" links a website section.'}
              {tab === 'sections' && 'Website sections in default order. "feature" makes a section available only when that feature is on.'}
              {tab === 'defaults' && 'Default configuration merged under customer values.'}
              {tab === 'roles' && 'Role presets for CRM/ERP workspaces. Permissions: "*", "*:read", "<module>:read|write|*", "users:manage".'}
              {tab === 'layoutVariants' && 'Design variations the customer can choose from.'}
            </p>
            <Textarea className="min-h-[520px] font-mono text-xs" value={jsonText[tab]} onChange={(e) => setJsonText({ ...jsonText, [tab]: e.target.value })} spellCheck={false} />
            {(() => { try { JSON.parse(jsonText[tab]); return null; } catch (e) { return <Alert tone="error">{(e as Error).message}</Alert>; } })()}
          </div>
        )}

        {tab === 'preview' && (
          sample && sampleTheme ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="border-b bg-muted px-3 py-1.5 text-xs text-muted-foreground">Master template with default content (draft)</div>
              <div className="h-[720px] overflow-y-auto">
                {draft.category === 'WEBSITE'
                  ? <SiteRenderer payload={{ mode: 'preview', project: { id: 'sample', name: draft.name, slug: 'sample', category: draft.category }, template: { key: draft.key, renderer: draft.renderer as never, name: draft.name, sections: merged!.sections.map((s) => ({ key: s.key, label: s.label })) }, theme: sampleTheme, config: sample }} />
                  : <WorkspacePreview config={sample} theme={sampleTheme} projectId="" name={draft.name} />}
              </div>
            </div>
          ) : <Alert tone="warning">Fix the definition errors to see a preview.</Alert>
        )}

        {tab === 'versions' && (
          <Table>
            <THead><TR><TH>Version</TH><TH>Changelog</TH><TH>Published</TH><TH>Projects</TH><TH /></TR></THead>
            <TBody>
              {t.versions.map((v: any) => (
                <TR key={v.id}>
                  <TD>v{v.version} {t.currentVersion?.id === v.id && <Badge tone="green">catalog</Badge>}</TD>
                  <TD className="max-w-xs truncate">{v.changelog}</TD>
                  <TD className="text-muted-foreground">{fmtDate(v.createdAt)}</TD>
                  <TD>{v._count.projects}</TD>
                  <TD className="space-x-1 whitespace-nowrap text-right">
                    <Button size="xs" variant="ghost" onClick={async () => setViewVersion(await api(`/admin/templates/${id}/versions/${v.id}`))}>View</Button>
                    {t.currentVersion?.id !== v.id && <Button size="xs" variant="outline" onClick={() => action(`/versions/${v.id}/make-current`, `Catalog now serves v${v.version}.`)}>Make current</Button>}
                    <Button size="xs" variant="outline" onClick={() => action(`/versions/${v.id}/load-draft`, `v${v.version} loaded into the draft.`)}>Load into draft</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish new version">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Creates an immutable snapshot of the current draft. New customers get it; existing projects stay pinned to their version.</p>
          <Field label="Version bump">
            <Select value={bump} onChange={(e) => setBump(e.target.value as typeof bump)}><option value="patch">Patch</option><option value="minor">Minor</option><option value="major">Major</option></Select>
          </Field>
          <Field label="Changelog"><Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} /></Field>
          <Alert tone="info">Save the draft first if you have unsaved edits.</Alert>
          <Button onClick={publish}>Publish</Button>
        </div>
      </Modal>
      <Modal open={!!viewVersion} onClose={() => setViewVersion(null)} title={`Version ${viewVersion?.version}`} wide>
        <JsonView value={viewVersion?.definition} />
      </Modal>
    </>
  );
}
