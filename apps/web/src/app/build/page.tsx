'use client';
/**
 * Instant Builder: the customer describes their business in their own words; fixed rules
 * (keyword lists + text patterns in @sf/templates) pick a template, fill the requirements,
 * choose library photos and write starter text. Nothing here calls an AI service.
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ImagePlus, Loader2, Monitor, Quote, RefreshCw, Shuffle, Smartphone, Sparkles, Tablet, Wand2, X } from 'lucide-react';
import {
  allFields, Analysis, analyseDescription, applyNameToValues, buildProjectConfig, composeDraft, Detection, Draft, getTheme, hashSeed,
  isFieldVisible, mapStrings, pickImages, StockImage, stockRef, validateSubmission, ValidationIssue,
} from '@sf/templates';
import type { TemplateDetail } from '@/app/templates/[key]/page';
import { FieldCtx, FieldInput } from '@/components/fields';
import { PlatformShell, useMe } from '@/components/shell';
import { DRAFT_PROJECT_ID, SitePayload } from '@/components/site/SiteRenderer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Alert, Badge, Spinner } from '@/components/ui/misc';
import { api, ApiError, upload } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CatalogItem { key: string; name: string; category: string }

const SESSION_KEY = 'sf:builder';
const EXAMPLES: { label: string; text: string }[] = [
  { label: 'Restaurant', text: 'I have a Desi restaurant called Saffron & Ember in Gulberg, Lahore. Phone 0300 1234567, email hello@saffronember.com. Open 12pm to 12am every day. I want online table booking and a WhatsApp button, warm red colours.\nMenu: Chicken Karahi Rs 1,650, Mutton Nihari Rs 1,850, Chicken Biryani Rs 1,100, Seekh Kebab Rs 1,400, Garlic Naan Rs 180, Mango Lassi Rs 450' },
  { label: 'Café', text: 'Bean There is a cosy coffee shop in Islamabad F-7. We serve Cappuccino Rs 650, Iced Latte Rs 750, Croissant Rs 450 and Brownie Rs 400. Open 8am to 11pm daily. Call 0333 7654321.' },
  { label: 'Salon', text: 'Glow Beauty Salon is a ladies salon in DHA Phase 6, Karachi. Haircut Rs 1,500, Hair colour Rs 6,000, Facial Rs 3,000, Bridal makeup Rs 25,000. Mon-Sat 11am-8pm, closed Sunday. Call or WhatsApp 0321 5550000. Pink, elegant look.' },
  { label: 'Agency', text: 'We are Pixel Forge, a digital marketing agency in Dubai. We do branding, web design, SEO and social media for 120+ clients. Bold look please. hello@pixelforge.ae, +971 50 123 4567' },
  { label: 'Portfolio', text: "I'm Sara Khan, a freelance photographer based in Islamabad. Skills: portraits, weddings, product photography, Lightroom, Photoshop. sara@example.com, 0300 9876543. Minimal white design." },
  { label: 'CRM', text: 'Need a CRM for my real estate company Prime Homes. Our sales team of 8 people tracks leads from Facebook, Instagram and referrals. Stages: New, Site visit, Negotiation, Closed. Sales manager and sales reps need logins. info@primehomes.pk' },
  { label: 'ERP', text: 'Bright Electric Traders is a wholesale distributor of electrical goods in Lahore with 25 employees. We need inventory management with suppliers, purchase orders, sales orders, invoices and low stock alerts. Currency PKR. Accountant and store keeper need access.' },
];
const DEVICES = { desktop: { w: '100%', icon: Monitor }, tablet: { w: '820px', icon: Tablet }, mobile: { w: '390px', icon: Smartphone } } as const;
const SOURCE_LABEL: Record<Detection['source'], { text: string; tone: 'green' | 'blue' | 'amber' | 'gray' | 'default' }> = {
  description: { text: 'From your description', tone: 'green' },
  generated: { text: 'Written for you', tone: 'blue' },
  library: { text: 'Library photo', tone: 'blue' },
  sample: { text: 'Sample — please replace', tone: 'amber' },
  account: { text: 'From your account', tone: 'gray' },
  template: { text: 'Template default', tone: 'gray' },
};
const QUICK_FIELDS = ['businessName', 'companyName', 'tagline', 'description', 'phone', 'email', 'address', 'whatsapp', 'role', 'cuisine', 'theme'];

function Builder() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();
  const [text, setText] = useState('');
  const [stage, setStage] = useState<'describe' | 'building' | 'review'>('describe');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [library, setLibrary] = useState<StockImage[]>([]);
  const [libReady, setLibReady] = useState(false);
  const details = useRef<Record<string, TemplateDetail>>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [seed, setSeed] = useState(0);
  const [imageSeed, setImageSeed] = useState(0);
  const [shown, setShown] = useState(0);
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
  const [error, setError] = useState('');
  const [serverIssues, setServerIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api<CatalogItem[]>('/catalog/templates').then(setCatalog).catch(() => setError('Could not load templates.'));
    api<StockImage[]>('/stock-images').then(setLibrary).catch(() => setLibrary([])).finally(() => setLibReady(true));
  }, []);

  const loadDetail = useCallback(async (key: string) => {
    if (!details.current[key]) details.current[key] = await api<TemplateDetail>(`/catalog/templates/${key}`);
    return details.current[key];
  }, []);

  // ---------------------------------------------------------------- build
  const build = useCallback(async (opts: { forcedKey?: string; animate?: boolean; seed?: number; keepEdits?: Record<string, unknown>; text?: string } = {}) => {
    const input = opts.text ?? text;
    if (!input.trim() || !catalog.length) return;
    setError('');
    setServerIssues([]);
    const a = analyseDescription(input, catalog.map((c) => c.key), opts.forcedKey);
    let d: TemplateDetail;
    try { d = await loadDetail(a.templateKey); } catch (e) { setError(`The ${catalog.find((c) => c.key === a.templateKey)?.name ?? 'matching'} template could not be loaded (${(e as Error).message}). Please try again.`); return; }
    const s = opts.seed ?? hashSeed(input);
    const dr = composeDraft(d.definition, a, { seed: s, accountEmail: me?.email, images: library });
    setAnalysis(a); setDetail(d); setDraft(dr); setSeed(s); setImageSeed(s); setEdits(opts.keepEdits ?? {});
    if (opts.animate === false) { setStage('review'); return; }
    setStage('building');
    setShown(0);
    for (let i = 1; i <= dr.steps.length; i++) {
      await new Promise((r) => setTimeout(r, i === 1 ? 350 : 480));
      setShown(i);
    }
    await new Promise((r) => setTimeout(r, 450));
    setStage('review');
  }, [text, catalog, library, loadDetail, me?.email]);

  // Resume after login, or start from a template's "describe instead" link.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !catalog.length || !libReady) return;
    if (params.get('resume')) {
      resumed.current = true;
      try {
        const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        if (saved?.text) {
          setText(saved.text);
          setUploads(saved.uploads ?? {});
          buildRef.current?.({ text: saved.text, forcedKey: saved.templateKey, animate: false, seed: saved.seed, keepEdits: saved.edits });
        }
      } catch { /* ignore */ }
    }
  }, [catalog, params, libReady]);
  const buildRef = useRef(build);
  buildRef.current = build;

  // ---------------------------------------------------------------- derived
  const def = detail?.definition;
  const values = useMemo(() => {
    if (!draft) return {};
    let v: Record<string, unknown> = { ...draft.values, ...edits };
    const name = (v.businessName ?? v.companyName) as string | undefined;
    if (name) v = applyNameToValues(v, name);
    return v;
  }, [draft, edits]);
  const ctxEngine = useMemo(() => ({ themes: detail?.themes, modules: detail?.modules }), [detail]);
  const validation = useMemo(() => (def ? validateSubmission(def, { values }, ctxEngine) : null), [def, values, ctxEngine]);
  const issues = serverIssues.length ? serverIssues : validation?.errors ?? [];
  const features = (values.features as string[]) ?? [];
  const libUrl = useMemo(() => Object.fromEntries(library.map((i) => [stockRef(i), i.url])), [library]);
  const resolve = useCallback((v: string) => libUrl[v] ?? uploads[v] ?? (v.startsWith('asset:') || v.startsWith('stock:') ? undefined : v), [libUrl, uploads]);

  const payload = useMemo<SitePayload | null>(() => {
    if (!def || !detail) return null;
    const cfg = buildProjectConfig(def, { values }, ctxEngine, { lenient: true });
    const config = mapStrings(cfg, (s) => (s.startsWith('stock:') || s.startsWith('asset:') ? resolve(s) ?? '' : s)) as typeof cfg;
    return {
      mode: 'preview',
      project: { id: DRAFT_PROJECT_ID, name: config.business.name, slug: 'draft', category: def.category },
      template: { key: def.key, renderer: def.renderer as SitePayload['template']['renderer'], name: def.name, sections: def.sections.map((x) => ({ key: x.key, label: x.label })) },
      theme: getTheme(config.branding.theme, detail.themes),
      config,
    };
  }, [def, detail, values, ctxEngine, resolve]);

  const push = useCallback(() => { if (payload) frame.current?.contentWindow?.postMessage({ type: 'sf:draft', payload }, window.location.origin); }, [payload]);
  useEffect(() => { push(); }, [push]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === 'sf:preview-ready') push(); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [push]);

  // live "we can already see…" hints while typing
  const [live, setLive] = useState<Analysis | null>(null);
  useEffect(() => {
    if (stage !== 'describe' || !catalog.length) return;
    const t = setTimeout(() => setLive(text.trim().length > 12 ? analyseDescription(text, catalog.map((c) => c.key)) : null), 350);
    return () => clearTimeout(t);
  }, [text, stage, catalog]);

  // ---------------------------------------------------------------- actions
  const setValue = (key: string, v: unknown) => { setServerIssues([]); setEdits((e) => ({ ...e, [key]: v })); };
  const shufflePhotos = () => {
    if (!draft) return;
    const s = imageSeed + 1;
    const count = ((values.gallery as string[]) ?? []).length || 4;
    const p = pickImages(library, draft.imageTags, s, count);
    setImageSeed(s);
    setEdits((e) => ({ ...e, ...(p.hero ? { heroImage: stockRef(p.hero) } : {}), gallery: p.gallery.map(stockRef) }));
  };
  const swapPhoto = (current: string | undefined, apply: (ref: string) => void) => {
    if (!draft) return;
    const used = new Set([values.heroImage, ...((values.gallery as string[]) ?? [])].filter(Boolean) as string[]);
    const pool = library.filter((i) => i.tags.some((t) => draft.imageTags.includes(t)) && !used.has(stockRef(i)));
    if (!pool.length) return;
    const idx = Math.abs(hashSeed(String(current) + imageSeed + used.size)) % pool.length;
    setImageSeed((x) => x + 1);
    apply(stockRef(pool[idx]));
  };
  const rewrite = () => {
    if (!detail || !analysis) return;
    const s = seed + 7;
    const dr = composeDraft(detail.definition, analysis, { seed: s, accountEmail: me?.email, images: library });
    setSeed(s);
    setDraft(dr);
    setEdits(({ tagline: _t, description: _d, mission: _m, ...rest }) => rest);
  };
  const switchTemplate = (key: string) => {
    const keep = Object.fromEntries(Object.entries(edits).filter(([k]) => ['businessName', 'companyName', 'email', 'phone', 'address'].includes(k)));
    if (keep.businessName && !keep.companyName) keep.companyName = keep.businessName;
    if (keep.companyName && !keep.businessName) keep.businessName = keep.companyName;
    build({ forcedKey: key, animate: false, seed, keepEdits: keep });
  };

  async function create() {
    if (!def || !draft) return;
    if (!me) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ text, templateKey: def.key, edits, seed, uploads }));
      router.push(`/login?next=${encodeURIComponent('/build?resume=1')}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const notes = draft.notices.filter((n) => !n.field && n.tone === 'info').map((n) => `• ${n.message}`).join('\n');
      const p = await api<{ id: string }>('/projects', { method: 'POST', json: { templateKey: def.key, values, prompt: text, notes: notes ? `Noted by the Instant Builder:\n${notes}` : undefined } });
      sessionStorage.removeItem(SESSION_KEY);
      router.push(def.category === 'WEBSITE' ? `/dashboard/projects/${p.id}/editor?created=1` : `/dashboard/projects/${p.id}?created=1`);
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      setServerIssues(err.issues ?? []);
    } finally {
      setBusy(false);
    }
  }

  function openFullForm() {
    if (!def) return;
    sessionStorage.setItem('sf:wizard-prefill', JSON.stringify({ templateKey: def.key, values, prompt: text, urls: { ...Object.fromEntries(Object.entries(libUrl)), ...uploads } }));
    router.push(`/new/${def.key}?prefill=1`);
  }

  // ---------------------------------------------------------------- render: describe
  if (stage === 'describe') {
    const top = live?.scores[0];
    const facts = live?.facts;
    const chips = facts ? [
      top && top.score > 0 ? `${catalog.find((c) => c.key === live!.templateKey)?.name ?? live!.templateKey}` : null,
      facts.name && `Name: ${facts.name.value}`, facts.email && 'Email', facts.phone && 'Phone', facts.city && facts.city.value,
      facts.cuisines && facts.cuisines.value.join(', '), facts.hours && 'Opening hours', facts.pricedItems.length ? `${facts.pricedItems.length} item(s) with prices` : null,
      facts.colours.length ? 'Colours' : null, ...Object.keys(facts.featuresOn).slice(0, 4),
    ].filter(Boolean) as string[] : [];
    return (
      <div className="mx-auto max-w-3xl py-6">
        <div className="text-center">
          <Badge tone="blue" className="mb-4"><Sparkles className="mr-1 h-3.5 w-3.5" />Instant Builder</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Describe your business. We&apos;ll build it instantly.</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Write a few lines the way you would explain it to a friend. We set up your website, CRM or ERP from a proven template, ready for you to edit.</p>
        </div>
        <div className="mt-8 rounded-xl border bg-card p-4 shadow-sm">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={5000} autoFocus
            placeholder="e.g. I have a Desi restaurant called Saffron & Ember in Lahore. Phone 0300 1234567. Open 12pm to 12am. We want table booking and WhatsApp. Menu: Chicken Karahi Rs 1650, Biryani Rs 1100…"
            className="resize-none border-0 text-base shadow-none focus-visible:ring-0" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex flex-wrap gap-1.5">
              <span className="py-1 text-xs text-muted-foreground">Try:</span>
              {EXAMPLES.map((x) => (
                <button key={x.label} onClick={() => setText(x.text)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted">{x.label}</button>
              ))}
            </div>
            <Button size="lg" onClick={() => build({ forcedKey: params.get('template') ?? undefined })} disabled={text.trim().length < 15 || !catalog.length || !libReady}>
              <Wand2 className="h-4 w-4" /> Build it
            </Button>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">We can already see:</span>
            {chips.map((c) => <Badge key={c} tone="green"><Check className="mr-1 h-3 w-3" />{c}</Badge>)}
          </div>
        )}
        {error && <Alert tone="error" className="mt-4">{error}</Alert>}
        <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="font-medium text-foreground">Helpful things to mention</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your business name and what you do</li>
              <li>City or address, phone and email</li>
              <li>Opening hours (e.g. &ldquo;Mon–Sat 9am–6pm&rdquo;)</li>
              <li>Menu items or services with prices</li>
              <li>Colours or a style you like (warm, modern, dark…)</li>
              <li>Features: bookings, WhatsApp, map, gallery</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <p className="font-medium text-foreground">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>We pick the best template and fill in your details</li>
              <li>We add photos and starter text you can replace</li>
              <li>You check everything in a live preview</li>
              <li>You create the project and fine-tune it in the editor</li>
            </ol>
            <p className="mt-3">Prefer a step-by-step form? <Link className="underline" href="/templates">Choose a template</Link>.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- render: building
  if (stage === 'building' && draft) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Wand2 className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="font-semibold">Building your {detail?.definition.category === 'WEBSITE' ? 'website' : 'workspace'}</p>
              <p className="text-sm text-muted-foreground">{detail?.name}</p>
            </div>
          </div>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(shown / draft.steps.length) * 100}%` }} />
          </div>
          <ul className="mt-6 space-y-2.5">
            {draft.steps.map((s, i) => (
              <li key={i} className={cn('flex items-center gap-2.5 text-sm transition-opacity duration-300', i < shown ? 'opacity-100' : i === shown ? 'opacity-60' : 'opacity-0')}>
                {i < shown ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                <span className={i === draft.steps.length - 1 && i < shown ? 'font-medium' : ''}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- render: review
  if (!def || !draft || !detail || !analysis) return <div className="py-20 text-center"><Spinner /></div>;
  const fields = allFields(def);
  const fieldCtx: FieldCtx = { def, themes: detail.themes, modules: detail.modules, unsupportedFeatures: detail.unsupportedFeatures, features, imageUrl: resolve, onUploaded: (ref, url) => setUploads((u) => ({ ...u, [ref]: url })) };
  const errorFor = (key: string) => issues.find((i) => i.path === key || i.path.startsWith(`${key}.`))?.message;
  const needs = fields.filter((f) => isFieldVisible(f, features) && issues.some((i) => i.path === f.key || i.path.startsWith(`${f.key}.`)));
  const quick = QUICK_FIELDS.map((k) => fields.find((f) => f.key === k)).filter((f): f is NonNullable<typeof f> => !!f && isFieldVisible(f, features) && !needs.includes(f));
  const isSite = def.category === 'WEBSITE';
  const hero = values.heroImage as string | undefined;
  const gallery = (values.gallery as string[] | undefined) ?? [];
  const alternatives = analysis.scores.filter((s) => s.key !== def.key && s.score > 0).slice(0, 2);
  const grouped = draft.detections.filter((d) => !['heroImage', 'gallery', 'font', 'layout'].includes(d.field));

  return (
    <div className="-mx-4 grid gap-5 sm:mx-0 lg:grid-cols-[1fr_400px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStage('describe')}><ArrowLeft className="h-4 w-4" /> Edit description</Button>
            <Badge tone="blue"><Sparkles className="mr-1 h-3 w-3" />Draft preview</Badge>
          </div>
          <div className="flex rounded-md border p-0.5">
            {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => {
              const Icon = DEVICES[d].icon;
              return <button key={d} onClick={() => setDevice(d)} className={cn('rounded px-2 py-1', device === d && 'bg-muted')} title={d}><Icon className="h-4 w-4" /></button>;
            })}
          </div>
        </div>
        <div className="flex h-[calc(100vh-190px)] min-h-[520px] justify-center rounded-lg border bg-muted/40 p-2">
          <iframe ref={frame} title="Draft preview" src="/build/frame" onLoad={push} className="h-full rounded-md border bg-white shadow transition-all" style={{ width: DEVICES[device].w, maxWidth: '100%' }} />
        </div>
      </div>

      <aside className="space-y-4 lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto lg:pr-1">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Template</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-semibold">{def.name}</p>
            <Badge tone={analysis.confidence === 'high' ? 'green' : analysis.confidence === 'medium' ? 'blue' : 'amber'}>{analysis.confidence === 'high' ? 'Strong match' : analysis.confidence === 'medium' ? 'Good match' : 'Best guess'}</Badge>
          </div>
          <select className="mt-3 w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={def.key} onChange={(e) => switchTemplate(e.target.value)}>
            {catalog.map((c) => <option key={c.key} value={c.key}>{c.category} · {c.name}</option>)}
          </select>
          {alternatives.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Also possible: {alternatives.map((a, i) => (
              <span key={a.key}>{i > 0 && ', '}<button className="underline" onClick={() => switchTemplate(a.key)}>{catalog.find((c) => c.key === a.key)?.name}</button></span>
            ))}</p>
          )}
        </div>

        {needs.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:bg-amber-950/20">
            <p className="font-semibold">Needs your input</p>
            <p className="mb-3 text-xs text-muted-foreground">We couldn&apos;t find these in your description.</p>
            <div className="space-y-4">
              {needs.map((f) => <FieldInput key={f.key} field={f} value={values[f.key]} ctx={fieldCtx} error={errorFor(f.key)} onChange={(v) => setValue(f.key, v)} compact />)}
            </div>
          </div>
        )}

        {draft.notices.length > 0 && (
          <div className="space-y-2">
            {draft.notices.map((n, i) => <Alert key={i} tone={n.tone === 'warning' ? 'warning' : 'info'} className="text-xs">{n.message}</Alert>)}
          </div>
        )}

        {isSite && (hero || gallery.length > 0 || library.length > 0) && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Photos</p>
              <Button variant="ghost" size="sm" onClick={shufflePhotos} disabled={!library.length}><Shuffle className="h-3.5 w-3.5" /> Shuffle</Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Library photos so your site looks complete. Swap them or upload your own.</p>
            {fields.some((f) => f.key === 'heroImage') && (
              <PhotoTile label="Main photo" value={hero} resolve={resolve} canUpload={!!me}
                onSwap={() => swapPhoto(hero, (r) => setValue('heroImage', r))} onUpload={(ref) => setValue('heroImage', ref)} onUploaded={(ref, url) => setUploads((u) => ({ ...u, [ref]: url }))} onRemove={() => setValue('heroImage', undefined)} large />
            )}
            {features.includes('gallery') && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {gallery.map((g, i) => (
                  <PhotoTile key={g + i} value={g} resolve={resolve} canUpload={!!me}
                    onSwap={() => swapPhoto(g, (r) => setValue('gallery', gallery.map((x, j) => (j === i ? r : x))))}
                    onUpload={(ref) => setValue('gallery', gallery.map((x, j) => (j === i ? ref : x)))} onUploaded={(ref, url) => setUploads((u) => ({ ...u, [ref]: url }))}
                    onRemove={() => setValue('gallery', gallery.filter((_, j) => j !== i))} />
                ))}
                {gallery.length < 12 && (
                  <PhotoTile resolve={resolve} canUpload={!!me} onUpload={(ref) => setValue('gallery', [...gallery, ref])} onUploaded={(ref, url) => setUploads((u) => ({ ...u, [ref]: url }))} />
                )}
              </div>
            )}
            {!me && <p className="mt-2 text-xs text-muted-foreground"><Link className="underline" href={`/login?next=${encodeURIComponent('/build?resume=1')}`}>Log in</Link> to upload your own photos.</p>}
          </div>
        )}

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Quick edits</p>
            {isSite && <Button variant="ghost" size="sm" onClick={rewrite}><RefreshCw className="h-3.5 w-3.5" /> New wording</Button>}
          </div>
          <div className="mt-3 space-y-4">
            {quick.map((f) => <FieldInput key={f.key} field={f} value={values[f.key]} ctx={fieldCtx} error={errorFor(f.key)} onChange={(v) => setValue(f.key, v)} compact />)}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <p className="font-semibold">What we understood</p>
          <ul className="mt-3 space-y-3">
            {grouped.map((d, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span><span className="text-muted-foreground">{d.label}:</span> {d.display.length > 90 ? d.display.slice(0, 90) + '…' : d.display}</span>
                  <Badge tone={SOURCE_LABEL[d.source].tone} className="shrink-0 text-[10px]">{SOURCE_LABEL[d.source].text}</Badge>
                </div>
                {d.evidence && <p className="mt-0.5 flex gap-1 text-xs text-muted-foreground"><Quote className="mt-0.5 h-3 w-3 shrink-0" />{d.evidence.length > 110 ? d.evidence.slice(0, 110) + '…' : d.evidence}</p>}
              </li>
            ))}
          </ul>
        </div>

        <div className="sticky bottom-0 space-y-2 rounded-lg border bg-background p-4 shadow-sm">
          {error && <Alert tone="error" className="text-xs">{error}</Alert>}
          {needs.length > 0 && <p className="text-xs text-amber-700">Fill in {needs.length} item{needs.length === 1 ? '' : 's'} above to continue.</p>}
          <Button className="w-full" size="lg" onClick={create} disabled={busy || !validation?.valid}>
            {busy ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <Wand2 className="h-4 w-4" />}
            {me ? `Create my ${isSite ? 'website' : 'workspace'}` : 'Log in to create it'}
          </Button>
          <button onClick={openFullForm} className="w-full text-center text-xs text-muted-foreground underline">Review every detail in the full form instead</button>
        </div>
      </aside>
    </div>
  );
}

function PhotoTile({ label, value, resolve, canUpload, onSwap, onUpload, onUploaded, onRemove, large }: {
  label?: string; value?: string; resolve: (v: string) => string | undefined; canUpload: boolean; large?: boolean;
  onSwap?: () => void; onUpload: (ref: string) => void; onUploaded: (ref: string, url: string) => void; onRemove?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = value ? resolve(value) : undefined;
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true); setErr('');
    try { const a = await upload(f, {}); onUploaded(a.ref, a.url); onUpload(a.ref); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return (
    <div>
      {label && <p className="mb-1 text-xs text-muted-foreground">{label}</p>}
      <div className={cn('group relative overflow-hidden rounded-md border bg-muted', large ? 'aspect-[16/7]' : 'aspect-square')}>
        {busy ? <div className="flex h-full items-center justify-center"><Spinner /></div>
          : url ? <img src={url} alt="" className="h-full w-full object-cover" />
          : <button disabled={!canUpload} onClick={() => input.current?.click()} className="flex h-full w-full items-center justify-center text-muted-foreground disabled:opacity-50" title="Add a photo"><ImagePlus className="h-5 w-5" /></button>}
        {url && !busy && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/55 p-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
            {onSwap && <button onClick={onSwap} className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-black" title="Another library photo"><Shuffle className="inline h-3 w-3" /></button>}
            {canUpload && <button onClick={() => input.current?.click()} className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-black">Upload</button>}
            {onRemove && <button onClick={onRemove} className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-black" title="Remove"><X className="inline h-3 w-3" /></button>}
          </div>
        )}
      </div>
      {err && <p className="mt-1 text-[10px] text-destructive">{err}</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export default function BuildPage() {
  return (
    <PlatformShell>
      <Suspense fallback={<div className="py-20 text-center"><Spinner /></div>}><Builder /></Suspense>
    </PlatformShell>
  );
}
