'use client';
import Link from 'next/link';
import { Plus, Wand2 } from 'lucide-react';
import { PlatformShell, RequireAuth, useMe } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { EmptyState, Loading, PageHeader, StatusBadge, Badge } from '@/components/ui/misc';
import { useApi } from '@/lib/api';
import { fmtDate } from '@/lib/utils';

interface ProjectRow { id: string; name: string; slug: string; category: string; status: string; updatedAt: string; isOwner: boolean; hasUnpublishedChanges: boolean; template: { name: string }; templateVersion: { version: string } }

function List() {
  const { me } = useMe();
  const { data, loading } = useApi<ProjectRow[]>('/projects');
  if (loading) return <Loading />;
  const owned = data?.filter((p) => p.isOwner) ?? [];
  return (
    <>
      <PageHeader
        title="My projects"
        description={me && <>Plan: <strong>{me.subscription?.plan ?? 'FREE'}</strong> · {owned.length} / {me.limits.maxProjects} projects</>}
        actions={<div className="flex gap-2"><Link href="/templates"><Button variant="outline"><Plus className="h-4 w-4" /> From a template</Button></Link><Link href="/build"><Button><Wand2 className="h-4 w-4" /> Describe &amp; build</Button></Link></div>}
      />
      {!data?.length ? (
        <EmptyState title="No projects yet"><Link className="underline" href="/build">Describe your business</Link> or <Link className="underline" href="/templates">choose a template</Link> to create your first project.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={p.isOwner ? `/dashboard/projects/${p.id}` : `/workspace/${p.id}`} className="rounded-lg border p-5 transition hover:shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-semibold">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.template.name} · v{p.templateVersion.version}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{p.category}</Badge>
                {!p.isOwner && <Badge tone="violet">Team member</Badge>}
                {p.hasUnpublishedChanges && <Badge tone="amber">Unpublished changes</Badge>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Updated {fmtDate(p.updatedAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return <PlatformShell><RequireAuth><List /></RequireAuth></PlatformShell>;
}
