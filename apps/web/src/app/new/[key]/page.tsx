'use client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { defaultFeatures, FormField, getPath, isFieldVisible, validateSubmission, ValidationIssue } from '@sf/templates';
import { FieldCtx, FieldInput } from '@/components/fields';
import { PlatformShell, RequireAuth } from '@/components/shell';
import type { TemplateDetail } from '@/app/templates/[key]/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Alert, Loading, Spinner } from '@/components/ui/misc';
import { api, ApiError, useApi } from '@/lib/api';
import { cn } from '@/lib/utils';

function initialValues(t: TemplateDetail): Record<string, unknown> {
  const d = t.definition;
  const v: Record<string, unknown> = {};
  for (const sec of d.formSchema) {
    for (const f of sec.fields) {
      if (f.type === 'features') v[f.key] = defaultFeatures(d);
      else if (f.type === 'modules') v[f.key] = [...((d.defaults.modules as string[]) ?? [])];
      else if (f.type === 'roles') v[f.key] = ['admin'];
      else if (f.type === 'theme') v[f.key] = (d.defaults.branding?.theme as string) || d.defaultTheme;
      else if (f.type === 'layout') v[f.key] = (d.defaults.branding?.layout as string) || d.layoutVariants[0]?.key;
      else if (f.type === 'font') v[f.key] = d.defaults.branding?.font;
      else if (f.bind !== 'business.name') {
        const def = getPath(d.defaults, f.bind);
        if (def !== undefined && !(Array.isArray(def) && def.length === 0 && f.type === 'repeater')) v[f.key] = JSON.parse(JSON.stringify(def));
      }
    }
  }
  return v;
}

/** Draft handed over from the Instant Builder ("review every detail in the full form"). */
function readPrefill(key: string): { values: Record<string, unknown>; urls: Record<string, string>; prompt?: string } | null {
  try {
    const p = JSON.parse(sessionStorage.getItem('sf:wizard-prefill') || 'null');
    return p?.templateKey === key ? p : null;
  } catch {
    return null;
  }
}

function Wizard({ t }: { t: TemplateDetail }) {
  const router = useRouter();
  const search = useSearchParams();
  const d = t.definition;
  const [prefill] = useState(() => (search.get('prefill') ? readPrefill(t.key) : null));
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initialValues(t), ...(prefill?.values ?? {}) }));
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>(() => prefill?.urls ?? {});
  const [notes, setNotes] = useState('');
  const [slug, setSlug] = useState('');
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const features = (values.features as string[]) ?? defaultFeatures(d);
  const sections = d.formSchema.filter((s) => s.fields.some((f) => isFieldVisible(f, features)));
  const steps = [...sections.map((s) => ({ key: s.key, title: s.title })), { key: '_project', title: 'Project & notes' }, { key: '_review', title: 'Review & submit' }];
  const validation = useMemo(() => validateSubmission(d, { values }, { themes: t.themes, modules: t.modules }), [d, values, t.themes, t.modules]);
  const issues = serverIssues.length ? serverIssues : validation.errors;

  const ctx: FieldCtx = {
    def: d, themes: t.themes, modules: t.modules, unsupportedFeatures: t.unsupportedFeatures, features,
    imageUrl: (v) => assetUrls[v] ?? (v.startsWith('asset:') || v.startsWith('stock:') ? undefined : v),
    onUploaded: (ref, url) => setAssetUrls((m) => ({ ...m, [ref]: url })),
  };
  const fieldError = (f: FormField) => issues.find((i) => i.path === f.key || i.path.startsWith(`${f.key}.`) || (['features', 'modules', 'roles'].includes(f.type) && i.path === f.type))?.message;
  const stepIssues = (i: number) => {
    const sec = sections[i];
    if (!sec) return [];
    const keys = new Set(sec.fields.filter((f) => isFieldVisible(f, features)).flatMap((f) => [f.key, f.type]));
    return issues.filter((x) => keys.has(x.path.split('.')[0]));
  };

  function next() {
    setTouched((s) => new Set(s).add(step));
    if (step < sections.length && stepIssues(step).length) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    setBusy(true);
    setError('');
    setServerIssues([]);
    try {
      const p = await api<{ id: string }>('/projects', { method: 'POST', json: { templateKey: t.key, values, notes, slug: slug || undefined, prompt: prefill?.prompt } });
      sessionStorage.removeItem('sf:wizard-prefill');
      router.push(`/dashboard/projects/${p.id}?created=1`);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      setServerIssues(err.issues ?? []);
    } finally {
      setBusy(false);
    }
  }

  const current = steps[step];
  const sec = sections[step];
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.category} · {t.name}</p>
        {prefill && <p className="mt-2 rounded bg-muted px-2 py-1 text-xs">Filled in from your description</p>}
        <ol className="mt-3 space-y-1">
          {steps.map((s, i) => {
            const bad = i < sections.length && touched.has(i) && stepIssues(i).length > 0;
            return (
              <li key={s.key}>
                <button onClick={() => setStep(i)} className={cn('w-full rounded px-2 py-1.5 text-left text-sm', i === step ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground', bad && 'text-destructive')}>
                  {i + 1}. {s.title}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
      <Card>
        <CardHeader>
          <CardTitle>{current.title}</CardTitle>
          {sec?.description && <CardDescription>{sec.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-5">
          {sec && sec.fields.filter((f) => isFieldVisible(f, features)).map((f) => (
            <FieldInput key={f.key} field={f} value={values[f.key]} ctx={ctx} error={touched.has(step) || serverIssues.length ? fieldError(f) : undefined}
              onChange={(v) => { setServerIssues([]); setValues((s) => ({ ...s, [f.key]: v })); }} />
          ))}
          {current.key === '_project' && (
            <>
              <Field label="Subdomain" help={`Your site will be available at <subdomain>.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localtest.me'} — leave empty to generate one from your business name.`}>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="royal-bites" className="max-w-sm" />
              </Field>
              <Field label="Additional customisation instructions" help="Saved as notes for our team. These are reviewed by a person and are not applied automatically.">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} maxLength={5000} className="max-w-2xl" />
              </Field>
            </>
          )}
          {current.key === '_review' && (
            <div className="space-y-4">
              {validation.valid && !serverIssues.length ? <Alert tone="success">Everything checks out against the {t.name} template.</Alert> : (
                <Alert tone="error">
                  <p className="font-medium">Please fix these before submitting:</p>
                  <ul className="mt-1 list-disc pl-5">{issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
                </Alert>
              )}
              {validation.warnings.map((w, k) => <Alert key={k} tone="warning">{w.message}</Alert>)}
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {d.formSchema.flatMap((s) => s.fields).filter((f) => isFieldVisible(f, features) && values[f.key] !== undefined && !['image', 'images', 'repeater', 'hours'].includes(f.type)).map((f) => (
                  <div key={f.key}><dt className="text-muted-foreground">{f.label}</dt><dd className="truncate">{Array.isArray(values[f.key]) ? (values[f.key] as string[]).join(', ') : String(values[f.key])}</dd></div>
                ))}
              </dl>
              {error && !serverIssues.length && <Alert tone="error">{error}</Alert>}
            </div>
          )}
          <div className="flex justify-between border-t pt-5">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            {current.key === '_review' ? (
              <Button onClick={submit} disabled={busy || !validation.valid}>{busy ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : null} Create my project</Button>
            ) : (
              <Button onClick={next}>Continue</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Loader() {
  const { key } = useParams<{ key: string }>();
  const { data, loading, error } = useApi<TemplateDetail>(`/catalog/templates/${key}`);
  if (loading) return <Loading />;
  if (error || !data) return <Alert tone="error">This template is not available.</Alert>;
  return <Wizard t={data} />;
}

export default function NewProjectPage() {
  return (
    <PlatformShell>
      <RequireAuth><Suspense fallback={<Loading />}><Loader /></Suspense></RequireAuth>
    </PlatformShell>
  );
}
