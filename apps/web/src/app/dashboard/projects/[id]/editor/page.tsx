'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, History, Monitor, Redo2, Save, Smartphone, Tablet, Undo2 } from 'lucide-react';
import { deriveNavigation, deriveSections, getPath, ProjectConfig, RoleDef, setPath, TemplateDefinition, ThemeDef, validateConfig, ValidationIssue } from '@sf/templates';
import { FieldCtx, FieldInput, ImageInput } from '@/components/fields';
import { MeProvider, RequireAuth } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form';
import { Alert, Badge, Loading, Modal, StatusBadge, Tabs } from '@/components/ui/misc';
import { api, ApiError, useApi } from '@/lib/api';
import { cn, fmtDate } from '@/lib/utils';
import type { ProjectDetail } from '../page';

const DEVICES = { desktop: { w: '100%', icon: Monitor }, tablet: { w: '820px', icon: Tablet }, mobile: { w: '390px', icon: Smartphone } } as const;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function Editor({ p, reload }: { p: ProjectDetail; reload: () => void }) {
  const def = p.templateVersion.definition as TemplateDefinition;
  const themes = p.themes as ThemeDef[];
  const isSite = def.category === 'WEBSITE';
  const [config, setConfig] = useState<ProjectConfig>(() => clone(p.config));
  const [past, setPast] = useState<ProjectConfig[]>([]);
  const [future, setFuture] = useState<ProjectConfig[]>([]);
  const [baseVersion, setBaseVersion] = useState(p.configVersion);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(p.config));
  const [tab, setTab] = useState('business');
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ tone: 'error' | 'success' | 'info'; text: string; issues?: ValidationIssue[] }>();
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const token = p.urls.previewUrl.split('/preview/')[1];
  const dirty = JSON.stringify(config) !== savedJson;
  const theme = themes.find((t) => t.key === config.branding.theme) ?? themes[0];
  const validation = useMemo(() => validateConfig(def, config, { themes, modules: p.modulesInfo }), [def, config, themes, p.modulesInfo]);

  /** Every edit goes through here so it lands on the undo stack. */
  const update = useCallback((fn: (c: ProjectConfig) => void) => {
    setConfig((prev) => {
      const next = clone(prev);
      fn(next);
      if (def.category === 'WEBSITE') {
        const labels = new Map(next.navigation.map((n) => [n.section, n.label]));
        next.navigation = deriveNavigation(def, next.sections).map((n) => ({ ...n, label: labels.get(n.section) ?? n.label }));
      }
      setPast((h) => [...h.slice(-99), prev]);
      setFuture([]);
      return next;
    });
  }, [def]);

  const undo = () => past.length && (setFuture((f) => [config, ...f]), setConfig(past[past.length - 1]), setPast((h) => h.slice(0, -1)));
  const redo = () => future.length && (setPast((h) => [...h, config]), setConfig(future[0]), setFuture((f) => f.slice(1)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).tagName.match(/INPUT|TEXTAREA/)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Live preview: push config into the iframe.
  const push = useCallback(() => frame.current?.contentWindow?.postMessage({ type: 'sf:config', config, theme }, window.location.origin), [config, theme]);
  useEffect(push, [push]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.origin === window.location.origin && e.data?.type === 'sf:preview-ready' && push();
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [push]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    setSaving(true);
    setStatus(undefined);
    try {
      const r = await api<{ configVersion: number; config: ProjectConfig }>(`/projects/${p.id}/config`, { method: 'PUT', json: { config, baseVersion, message: message || undefined } });
      setBaseVersion(r.configVersion);
      setConfig(r.config);
      setSavedJson(JSON.stringify(r.config));
      setMessage('');
      setStatus({ tone: 'success', text: `Saved as version ${r.configVersion}.${p.status === 'PUBLISHED' ? ' Publish from the project page to make it live.' : ''}` });
    } catch (e) {
      const err = e as ApiError;
      setStatus({ tone: 'error', text: err.message, issues: err.issues });
    } finally {
      setSaving(false);
    }
  }

  const ctx: FieldCtx = { def, themes, modules: p.modulesInfo, features: config.features, projectId: p.id, imageUrl: (v) => v };
  const bound = (bind: string) => ({ value: getPath(config, bind), onChange: (v: unknown) => update((c) => setPath(c as unknown as Record<string, unknown>, bind, v)) });
  const contentFields = def.formSchema.flatMap((s) => s.fields).filter((f) => /^(content|images)\./.test(f.bind) && (!f.showIfFeature || config.features.includes(f.showIfFeature)));

  const tabs = [
    { key: 'business', label: 'Business' },
    { key: 'branding', label: 'Design' },
    ...(isSite ? [{ key: 'sections', label: 'Sections' }] : [{ key: 'modules', label: 'Modules' }]),
    { key: 'content', label: 'Content' },
    { key: 'features', label: 'Features' },
  ];

  return (
    <div className="flex h-screen flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Link href={`/dashboard/projects/${p.id}`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {p.name}</Button></Link>
        <StatusBadge status={p.status} />
        <span className="text-xs text-muted-foreground">v{baseVersion}{dirty && ' · unsaved changes'}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="icon" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          <div className="mx-2 inline-flex rounded-md border p-0.5">
            {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => {
              const Icon = DEVICES[d].icon;
              return <button key={d} onClick={() => setDevice(d)} className={cn('rounded px-2 py-1', device === d && 'bg-muted')} title={d}><Icon className="h-4 w-4" /></button>;
            })}
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /> History</Button>
          <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe change (optional)" className="h-9 w-52" />
          <Button size="sm" onClick={save} disabled={!dirty || saving || !validation.valid}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* controls */}
        <div className="w-full shrink-0 overflow-y-auto border-r p-4 lg:w-[420px]">
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          <div className="mt-4 space-y-4">
            {status && (
              <Alert tone={status.tone}>
                {status.text}
                {status.issues?.length ? <ul className="mt-1 list-disc pl-4">{status.issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul> : null}
              </Alert>
            )}
            {!validation.valid && (
              <Alert tone="warning"><ul className="list-disc pl-4">{validation.errors.map((i, k) => <li key={k}>{i.message}</li>)}</ul></Alert>
            )}

            {tab === 'business' && (
              <>
                <Field label="Business name" required><Input value={config.business.name} maxLength={80} onChange={(e) => update((c) => { c.business.name = e.target.value; })} /></Field>
                {isSite && <Field label="Tagline"><Input value={config.business.tagline ?? ''} maxLength={120} onChange={(e) => update((c) => { c.business.tagline = e.target.value; })} /></Field>}
                <Field label="Description"><Textarea rows={5} value={config.business.description ?? ''} onChange={(e) => update((c) => { c.business.description = e.target.value; })} /></Field>
                <Field label="Email"><Input type="email" value={config.business.email ?? ''} onChange={(e) => update((c) => { c.business.email = e.target.value || undefined; })} /></Field>
                <Field label="Phone"><Input value={config.business.phone ?? ''} onChange={(e) => update((c) => { c.business.phone = e.target.value || undefined; })} /></Field>
                {config.features.includes('whatsapp') && <Field label="WhatsApp"><Input value={config.business.whatsapp ?? ''} onChange={(e) => update((c) => { c.business.whatsapp = e.target.value || undefined; })} /></Field>}
                {isSite && <Field label="Address"><Textarea rows={2} value={config.business.address ?? ''} onChange={(e) => update((c) => { c.business.address = e.target.value || undefined; })} /></Field>}
                {config.features.includes('hours') && <FieldInput field={{ key: 'hours', label: 'Opening hours', type: 'hours', bind: 'business.hours' }} {...bound('business.hours')} ctx={ctx} />}
              </>
            )}

            {tab === 'branding' && (
              <>
                <Field label="Logo"><ImageInput value={config.branding.logo} onChange={(v) => update((c) => { c.branding.logo = v; })} ctx={ctx} kind="logo" /></Field>
                <FieldInput field={{ key: 'theme', label: 'Theme', type: 'theme', bind: 'branding.theme' }} value={config.branding.theme} ctx={ctx}
                  onChange={(v) => update((c) => {
                    const t = themes.find((x) => x.key === v);
                    c.branding.theme = v as string;
                    if (t) { c.branding.primaryColor = t.tokens.primary; c.branding.secondaryColor = t.tokens.secondary; c.branding.accentColor = t.tokens.accent; }
                  })} />
                <FieldInput field={{ key: 'layout', label: isSite ? 'Design variation' : 'Navigation style', type: 'layout', bind: 'branding.layout' }} {...bound('branding.layout')} ctx={ctx} />
                <Field label="Font">
                  <Select value={config.branding.font} onChange={(e) => update((c) => { c.branding.font = e.target.value; })}>
                    {def.fonts.map((f) => <option key={f}>{f}</option>)}
                  </Select>
                </Field>
                {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((k) => (
                  <FieldInput key={k} field={{ key: k, label: k.replace('Color', ' colour').replace(/^./, (s) => s.toUpperCase()), type: 'color', bind: `branding.${k}` }} {...bound(`branding.${k}`)} ctx={ctx} />
                ))}
              </>
            )}

            {tab === 'sections' && isSite && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Show, hide, reorder and rename sections. The navigation menu follows automatically.</p>
                {config.sections.map((s, i) => {
                  const sdef = def.sections.find((d) => d.key === s.key)!;
                  const featureOff = sdef.feature && !config.features.includes(sdef.feature);
                  const featureLabel = def.features.find((f) => f.key === sdef.feature)?.label;
                  return (
                    <div key={s.key} className={cn('rounded-md border p-3', !s.enabled && 'opacity-60')}>
                      <div className="flex items-center gap-2">
                        <Switch checked={s.enabled} disabled={sdef.required || !!featureOff} label={sdef.label}
                          onChange={(v) => update((c) => { c.sections[i].enabled = v; })} />
                        <span className="text-sm font-medium">{sdef.label}</span>
                        {sdef.required && <Badge tone="gray">required</Badge>}
                        <div className="ml-auto flex">
                          <Button variant="ghost" size="icon" disabled={i <= 1 || s.key === 'hero'} onClick={() => update((c) => { [c.sections[i - 1], c.sections[i]] = [c.sections[i], c.sections[i - 1]]; })} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" disabled={i === config.sections.length - 1 || s.key === 'hero'} onClick={() => update((c) => { [c.sections[i + 1], c.sections[i]] = [c.sections[i], c.sections[i + 1]]; })} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      {featureOff && <p className="mt-1 text-xs text-muted-foreground">Enable “{featureLabel}” in Features to use this section.</p>}
                      {s.key !== 'hero' && s.enabled && (
                        <Input className="mt-2 h-8" placeholder={`Title (default: ${sdef.label})`} maxLength={60} value={s.title ?? ''}
                          onChange={(e) => update((c) => {
                            c.sections[i].title = e.target.value || undefined;
                            c.navigation = c.navigation.map((n) => (n.section === s.key ? { ...n, label: e.target.value || sdef.label } : n));
                          })} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'modules' && !isSite && (
              <>
                <FieldInput field={{ key: 'modules', label: 'Modules', type: 'modules', bind: 'modules' }} {...bound('modules')} ctx={ctx} />
                <FieldInput field={{ key: 'roles', label: 'User roles', type: 'roles', bind: 'roles' }} value={config.roles.map((r) => r.key)} ctx={ctx}
                  onChange={(keys) => update((c) => { c.roles = def.roles.filter((r: RoleDef) => r.key === 'admin' || (keys as string[]).includes(r.key)); })} />
              </>
            )}

            {tab === 'content' && (
              contentFields.length === 0 ? <p className="text-sm text-muted-foreground">No editable content for the enabled features.</p> :
                contentFields.map((f) => <FieldInput key={f.key} field={f} {...bound(f.bind)} ctx={ctx} compact />)
            )}

            {tab === 'features' && (
              <FieldInput field={{ key: 'features', label: 'Features', type: 'features', bind: 'features' }} value={config.features} ctx={ctx}
                onChange={(v) => update((c) => { c.features = v as string[]; c.sections = deriveSections(def, c.features, c.sections); })} />
            )}
          </div>
        </div>

        {/* preview */}
        <div className="flex min-h-[60vh] flex-1 justify-center overflow-auto bg-muted p-4">
          <iframe ref={frame} title="Live preview" src={`/preview/${token}?embed=1`} onLoad={push}
            className="h-full rounded-md border bg-white shadow transition-all" style={{ width: DEVICES[device].w, maxWidth: '100%' }} />
        </div>
      </div>

      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} projectId={p.id} current={baseVersion}
        onRestored={(v, cfg) => { setBaseVersion(v); setConfig(cfg); setSavedJson(JSON.stringify(cfg)); setPast([]); setFuture([]); setStatus({ tone: 'success', text: `Restored — saved as version ${v}.` }); reload(); }} />
    </div>
  );
}

function HistoryModal({ open, onClose, projectId, current, onRestored }: { open: boolean; onClose: () => void; projectId: string; current: number; onRestored: (v: number, c: ProjectConfig) => void }) {
  const { data, reload } = useApi<{ version: number; message: string; createdAt: string }[]>(open ? `/projects/${projectId}/versions` : null);
  useEffect(() => { if (open) reload(); }, [open, current, reload]);
  return (
    <Modal open={open} onClose={onClose} title="Version history">
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {data?.map((v) => (
          <div key={v.version} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div>
              <div className="font-medium">v{v.version} {v.version === current && <Badge tone="blue">current</Badge>}</div>
              <div className="text-muted-foreground">{v.message} · {fmtDate(v.createdAt)}</div>
            </div>
            {v.version !== current && (
              <Button size="xs" variant="outline" onClick={async () => {
                const r = await api<{ configVersion: number; config: ProjectConfig }>(`/projects/${projectId}/versions/${v.version}/restore`, { method: 'POST' });
                onRestored(r.configVersion, r.config);
                onClose();
              }}>Restore</Button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function Loader() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useApi<ProjectDetail>(`/projects/${id}`);
  if (error) return <div className="p-8"><Alert tone="error">{error.message}</Alert></div>;
  if (!data) return <Loading />;
  if (!data.themes) return <div className="p-8"><Alert tone="error">Only the project owner can edit this project.</Alert></div>;
  return <Editor p={data} reload={reload} />;
}

export default function EditorPage() {
  return <MeProvider><RequireAuth><Loader /></RequireAuth></MeProvider>;
}
