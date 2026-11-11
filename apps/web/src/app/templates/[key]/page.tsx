'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Lock } from 'lucide-react';
import type { FeatureDef, ModuleDef, TemplateDefinition, ThemeDef } from '@sf/templates';
import { PlatformShell } from '@/components/shell';
import { TemplateThumb } from '@/components/template-thumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Badge, Loading } from '@/components/ui/misc';
import { useApi } from '@/lib/api';

export interface TemplateDetail { id: string; key: string; name: string; category: string; description: string; version: string; previewImages: string[]; definition: TemplateDefinition; themes: ThemeDef[]; modules: ModuleDef[]; unsupportedFeatures: FeatureDef[] }

function Detail() {
  const { key } = useParams<{ key: string }>();
  const { data: t, loading, error } = useApi<TemplateDetail>(`/catalog/templates/${key}`);
  if (loading) return <Loading />;
  if (error || !t) return <Alert tone="error">Template not found.</Alert>;
  const d = t.definition;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="overflow-hidden rounded-lg border"><TemplateThumb templateKey={t.key} image={t.previewImages[0]} /></div>
        {t.previewImages.length > 1 && <div className="mt-3 grid grid-cols-4 gap-2">{t.previewImages.slice(1).map((src) => <img key={src} src={src} alt="" className="aspect-video rounded border object-cover" />)}</div>}
      </div>
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2"><Badge>{t.category}</Badge><Badge tone="gray">v{t.version}</Badge></div>
          <h1 className="mt-2 text-3xl font-semibold">{t.name}</h1>
          <p className="mt-2 text-muted-foreground">{t.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/build?template=${t.key}`}><Button size="lg">Describe your business</Button></Link>
            <Link href={`/new/${t.key}`}><Button size="lg" variant="outline">Fill in the form</Button></Link>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Supported features</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {d.features.map((f) => <div key={f.key} className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" />{f.label}</div>)}
            {t.unsupportedFeatures.map((f) => <div key={f.key} className="flex gap-2 text-muted-foreground"><Lock className="h-4 w-4" />{f.label} <span className="text-xs">(not in this template)</span></div>)}
          </CardContent>
        </Card>
        {t.modules.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t.category === 'WEBSITE' ? 'Built-in data' : 'Modules'}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {t.modules.map((m) => <div key={m.key}><strong>{m.name}</strong> — <span className="text-muted-foreground">{m.description}</span></div>)}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">Themes & design variations</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {t.themes.map((th) => (
                <div key={th.key} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
                  <span className="h-3 w-3 rounded-full" style={{ background: th.tokens.primary }} />{th.name}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{d.layoutVariants.map((l) => l.label).join(' · ')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function TemplateDetailPage() {
  return <PlatformShell><Detail /></PlatformShell>;
}
