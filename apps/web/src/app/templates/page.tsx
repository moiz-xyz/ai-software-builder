'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PlatformShell } from '@/components/shell';
import { TemplateThumb } from '@/components/template-thumb';
import { Badge, Loading, PageHeader, Tabs } from '@/components/ui/misc';
import { useApi } from '@/lib/api';

interface CatalogItem { key: string; name: string; category: string; description: string; version: string; features: { key: string; label: string }[]; modules: string[]; themes: string[]; previewImages: string[] }

function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const category = params.get('category') || 'WEBSITE';
  const { data, loading } = useApi<CatalogItem[]>(`/catalog/templates?category=${category}`);
  return (
    <>
      <PageHeader title="Template library" description="Every template is a complete, working product. Pick one to start your project." />
      <Tabs tabs={[{ key: 'WEBSITE', label: 'Websites' }, { key: 'CRM', label: 'CRM' }, { key: 'ERP', label: 'ERP' }]} value={category} onChange={(k) => router.push(`/templates?category=${k}`)} />
      {loading ? <Loading /> : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((t) => (
            <Link key={t.key} href={`/templates/${t.key}`} className="group overflow-hidden rounded-lg border transition hover:shadow-md">
              <TemplateThumb templateKey={t.key} image={t.previewImages[0]} />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t.name}</h3>
                  <Badge tone="gray">v{t.version}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(t.category === 'WEBSITE' ? t.features.map((f) => f.label) : t.modules).slice(0, 6).map((x) => <Badge key={x}>{x}</Badge>)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function TemplatesPage() {
  return <PlatformShell><Suspense fallback={<Loading />}><Catalog /></Suspense></PlatformShell>;
}
