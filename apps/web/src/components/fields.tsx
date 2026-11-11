'use client';
/**
 * Schema-driven form fields. The same components render the customer requirements
 * wizard (values keyed by field.key) and the visual editor (values bound to config paths).
 */
import type { FeatureDef, FormField, ModuleDef, OpeningHours, RoleDef, TemplateDefinition, ThemeDef } from '@sf/templates';
import { ImagePlus, Lock, Plus, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { upload } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form';
import { Spinner } from '@/components/ui/misc';

export interface FieldCtx {
  def: TemplateDefinition;
  themes: ThemeDef[];
  modules: ModuleDef[];
  unsupportedFeatures?: FeatureDef[];
  /** Currently enabled features (for showIfFeature). */
  features: string[];
  /** Upload target. Wizard → staging (returns asset ref); editor → project (returns URL). */
  projectId?: string;
  /** Map an image value (asset ref or URL) to a displayable URL. */
  imageUrl: (v: string) => string | undefined;
  onUploaded?: (ref: string, url: string) => void;
}

export function ImageInput({ value, onChange, ctx, kind }: { value?: string; onChange: (v: string | undefined) => void; ctx: FieldCtx; kind?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = value ? ctx.imageUrl(value) : undefined;
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const a = await upload(f, { projectId: ctx.projectId, kind });
      ctx.onUploaded?.(a.ref, a.url);
      onChange(ctx.projectId ? a.url : a.ref);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {busy ? <Spinner /> : url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={busy}>{value ? 'Replace' : 'Upload'}</Button>
          {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>Remove</Button>}
        </div>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

function ImagesInput({ value, onChange, ctx, max }: { value: string[]; onChange: (v: string[]) => void; ctx: FieldCtx; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr('');
    const out = [...value];
    try {
      for (const f of Array.from(files)) {
        if (max && out.length >= max) break;
        const a = await upload(f, { projectId: ctx.projectId });
        ctx.onUploaded?.(a.ref, a.url);
        out.push(ctx.projectId ? a.url : a.ref);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      onChange(out);
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((v, i) => (
          <div key={v + i} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
            <img src={ctx.imageUrl(v)} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100" aria-label="Remove image">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {(!max || value.length < max) && (
          <button type="button" onClick={() => ref.current?.click()} className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted" disabled={busy}>
            {busy ? <Spinner /> : <Plus className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input ref={ref} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => pick(e.target.files)} />
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

function HoursInput({ value, onChange }: { value: OpeningHours[]; onChange: (v: OpeningHours[]) => void }) {
  const set = (i: number, patch: Partial<OpeningHours>) => onChange(value.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  return (
    <div className="space-y-2">
      {value.map((h, i) => (
        <div key={h.day} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-24">{h.day}</span>
          <Input type="time" className="h-8 w-28" value={h.open} disabled={h.closed} onChange={(e) => set(i, { open: e.target.value })} />
          <span>–</span>
          <Input type="time" className="h-8 w-28" value={h.close} disabled={h.closed} onChange={(e) => set(i, { close: e.target.value })} />
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input type="checkbox" checked={!!h.closed} onChange={(e) => set(i, { closed: e.target.checked })} /> Closed
          </label>
        </div>
      ))}
    </div>
  );
}

function RepeaterInput({ field, value, onChange, ctx }: { field: FormField; value: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void; ctx: FieldCtx }) {
  const items = value ?? [];
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field.itemFields?.map((sub) => (
              <FieldInput key={sub.key} field={sub} value={item?.[sub.key]} onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, [sub.key]: v } : it)))} ctx={ctx} compact />
            ))}
          </div>
        </div>
      ))}
      {(!field.max || items.length < field.max) && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, {}])}>
          <Plus className="h-4 w-4" /> Add {field.label.toLowerCase().replace(/s$/, '')}
        </Button>
      )}
    </div>
  );
}

function ThemePicker({ value, onChange, ctx }: { value?: string; onChange: (v: string) => void; ctx: FieldCtx }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ctx.def.themes.map((key) => {
        const t = ctx.themes.find((x) => x.key === key);
        if (!t) return null;
        return (
          <button type="button" key={key} onClick={() => onChange(key)} className={cn('rounded-md border p-2 text-left text-xs transition', value === key ? 'ring-2 ring-ring' : 'hover:border-foreground/30')}>
            <div className="mb-2 flex h-10 overflow-hidden rounded" style={{ background: t.tokens.background }}>
              <div className="w-1/3" style={{ background: t.tokens.primary }} />
              <div className="w-1/3" style={{ background: t.tokens.surface }} />
              <div className="w-1/3" style={{ background: t.tokens.accent }} />
            </div>
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

function FeaturesInput({ value, onChange, ctx }: { value: string[]; onChange: (v: string[]) => void; ctx: FieldCtx }) {
  const toggle = (k: string, on: boolean) => onChange(on ? [...value, k] : value.filter((x) => x !== k));
  return (
    <div className="space-y-2">
      {ctx.def.features.map((f) => {
        const missing = (f.requires ?? []).filter((r) => !value.includes(r));
        return (
          <div key={f.key} className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">{f.label}</div>
              {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
              {value.includes(f.key) && missing.length > 0 && <div className="text-xs text-amber-700">Requires: {missing.map((m) => ctx.def.features.find((x) => x.key === m)?.label ?? m).join(', ')}</div>}
            </div>
            <Switch checked={value.includes(f.key)} onChange={(on) => toggle(f.key, on)} label={f.label} />
          </div>
        );
      })}
      {!!ctx.unsupportedFeatures?.length && (
        <div className="pt-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Not supported by this template</p>
          {ctx.unsupportedFeatures.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4 rounded-md border border-dashed p-3 opacity-60" title={`${f.label} is not supported by ${ctx.def.name}. Choose a different template if you need it.`}>
              <div>
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">Not supported by {ctx.def.name}. Pick another template if you need this.</div>
              </div>
              <Lock className="h-4 w-4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModulesInput({ value, onChange, ctx }: { value: string[]; onChange: (v: string[]) => void; ctx: FieldCtx }) {
  const required = ctx.def.requiredModules ?? [];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ctx.def.modules.map((key) => {
        const m = ctx.modules.find((x) => x.key === key);
        const isReq = required.includes(key);
        const on = isReq || value.includes(key);
        return (
          <div key={key} className={cn('flex items-start justify-between gap-3 rounded-md border p-3', on && 'border-foreground/30 bg-muted/40')}>
            <div>
              <div className="text-sm font-medium">{m?.name ?? key}{isReq && <span className="ml-2 text-xs text-muted-foreground">(always included)</span>}</div>
              <div className="text-xs text-muted-foreground">{m?.description}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m?.entities.map((e) => e.plural).join(' · ')}</div>
            </div>
            <Switch checked={on} disabled={isReq} onChange={(v) => onChange(v ? [...value, key] : value.filter((x) => x !== key))} label={m?.name ?? key} />
          </div>
        );
      })}
    </div>
  );
}

function RolesInput({ value, onChange, roles }: { value: string[]; onChange: (v: string[]) => void; roles: RoleDef[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {roles.map((r) => {
        const isAdmin = r.key === 'admin';
        const on = isAdmin || value.includes(r.key);
        return (
          <label key={r.key} className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3', on && 'bg-muted/40')}>
            <input type="checkbox" className="mt-1" checked={on} disabled={isAdmin} onChange={(e) => onChange(e.target.checked ? [...value, r.key] : value.filter((x) => x !== r.key))} />
            <div>
              <div className="text-sm font-medium">{r.name}{isAdmin && <span className="ml-1 text-xs text-muted-foreground">(always)</span>}</div>
              <div className="text-xs text-muted-foreground">{r.permissions.join(', ')}</div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

/** Renders the right control for a form field. */
export function FieldInput({ field, value, onChange, ctx, error, compact }: { field: FormField; value: unknown; onChange: (v: unknown) => void; ctx: FieldCtx; error?: string; compact?: boolean }) {
  const str = (value as string) ?? '';
  let control: React.ReactNode;
  switch (field.type) {
    case 'textarea':
      control = <Textarea value={str} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} rows={compact ? 2 : 4} />;
      break;
    case 'email':
    case 'phone':
    case 'url':
    case 'text':
      control = <Input type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'} value={str} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
      control = <Input type="number" value={value === undefined || value === null ? '' : String(value)} min={field.min} max={field.max} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
      break;
    case 'select':
      control = (
        <Select value={str} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Select…</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      );
      break;
    case 'multiselect':
      control = (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const arr = (value as string[]) ?? [];
            const on = arr.includes(o.value);
            return <button type="button" key={o.value} onClick={() => onChange(on ? arr.filter((x) => x !== o.value) : [...arr, o.value])} className={cn('rounded-full border px-3 py-1 text-sm', on && 'bg-primary text-primary-foreground')}>{o.label}</button>;
          })}
        </div>
      );
      break;
    case 'checkbox':
      control = <Switch checked={!!value} onChange={onChange} label={field.label} />;
      break;
    case 'color':
      control = (
        <div className="flex items-center gap-2">
          <input type="color" value={str || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded border" aria-label={field.label} />
          <Input value={str} placeholder="Theme default" onChange={(e) => onChange(e.target.value || undefined)} className="w-32 font-mono" />
        </div>
      );
      break;
    case 'image':
      control = <ImageInput value={str || undefined} onChange={onChange} ctx={ctx} kind={field.key === 'logo' ? 'logo' : undefined} />;
      break;
    case 'images':
      control = <ImagesInput value={(value as string[]) ?? []} onChange={onChange} ctx={ctx} max={field.max} />;
      break;
    case 'list':
      control = <Textarea value={((value as string[]) ?? []).join('\n')} onChange={(e) => onChange(e.target.value.split('\n'))} rows={4} placeholder="One per line" />;
      break;
    case 'hours':
      control = <HoursInput value={(value as OpeningHours[]) ?? (ctx.def.defaults.business?.hours as OpeningHours[]) ?? []} onChange={onChange} />;
      break;
    case 'repeater':
      control = <RepeaterInput field={field} value={(value as Record<string, unknown>[]) ?? []} onChange={onChange} ctx={ctx} />;
      break;
    case 'theme':
      control = <ThemePicker value={str} onChange={onChange} ctx={ctx} />;
      break;
    case 'layout':
      control = (
        <div className="grid gap-2 sm:grid-cols-3">
          {ctx.def.layoutVariants.map((l) => (
            <button type="button" key={l.key} onClick={() => onChange(l.key)} className={cn('rounded-md border p-3 text-left', str === l.key ? 'ring-2 ring-ring' : 'hover:border-foreground/30')}>
              <div className="text-sm font-medium">{l.label}</div>
              {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
            </button>
          ))}
        </div>
      );
      break;
    case 'font':
      control = (
        <Select value={str} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Template default</option>
          {ctx.def.fonts.map((f) => <option key={f} value={f}>{f}</option>)}
        </Select>
      );
      break;
    case 'features':
      control = <FeaturesInput value={(value as string[]) ?? []} onChange={onChange} ctx={ctx} />;
      break;
    case 'modules':
      control = <ModulesInput value={(value as string[]) ?? []} onChange={onChange} ctx={ctx} />;
      break;
    case 'roles':
      control = <RolesInput value={(value as string[]) ?? []} onChange={onChange} roles={ctx.def.roles} />;
      break;
  }
  if (field.type === 'features' || field.type === 'modules' || field.type === 'roles') {
    return (
      <div className="space-y-1.5">
        {field.type === 'roles' && <p className="text-sm font-medium">{field.label}</p>}
        {control}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
  return (
    <Field label={field.label} help={field.help} error={error} required={field.required} className={compact ? undefined : 'max-w-2xl'}>
      {control}
    </Field>
  );
}
