'use client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { ArrowLeft, LayoutDashboard, Users } from 'lucide-react';
import { WorkspaceCtx, WorkspaceMeta } from '@/components/workspace-ctx';
import { MeProvider, RequireAuth } from '@/components/shell';
import { Alert, Loading } from '@/components/ui/misc';
import { useApi } from '@/lib/api';
import { cn } from '@/lib/utils';

function Shell({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const path = usePathname();
  const { data: meta, error } = useApi<WorkspaceMeta>(`/projects/${id}/workspace/meta`);
  if (error) return <div className="container py-10"><Alert tone="error">{error.status === 404 ? 'Workspace not found or you do not have access.' : error.message}</Alert></div>;
  if (!meta) return <Loading />;
  const b = meta.config.branding;
  const top = b.layout === 'topbar';
  const items = [
    { href: `/workspace/${id}`, label: 'Dashboard', icon: LayoutDashboard },
    ...meta.entities.filter((e) => e.canRead).map((e) => ({ href: `/workspace/${id}/${e.key}`, label: e.plural, icon: null })),
    ...(meta.canManageUsers && meta.project.category !== 'WEBSITE' ? [{ href: `/workspace/${id}/users`, label: 'Users', icon: Users }] : []),
  ];
  return (
    <WorkspaceCtx.Provider value={meta}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(b.font)}:wght@400;500;600&display=swap`} />
      <div className={cn('flex min-h-screen', top ? 'flex-col' : 'flex-col md:flex-row')} style={{ fontFamily: `"${b.font}", ui-sans-serif, system-ui` }}>
        <aside className={cn('shrink-0 text-white', top ? 'w-full' : 'md:min-h-screen md:w-60')} style={{ background: b.primaryColor }}>
          <div className={cn('flex gap-1 p-3', top ? 'flex-wrap items-center' : 'flex-row flex-wrap md:flex-col')}>
            <div className={cn('flex items-center gap-2 px-2 py-2 font-semibold', !top && 'md:mb-4')}>
              {b.logo && <img src={b.logo} alt="" className="h-8 rounded bg-white p-0.5" />}
              <span className="truncate">{meta.config.business.name}</span>
            </div>
            {items.map((it) => {
              const active = path === it.href;
              return (
                <Link key={it.href} href={it.href} className={cn('rounded-md px-3 py-2 text-sm transition', active ? 'bg-white/20 font-medium' : 'opacity-85 hover:bg-white/10')}>
                  {it.label}
                </Link>
              );
            })}
            {meta.isOwner && (
              <Link href={meta.project.category === 'WEBSITE' || meta.isOwner ? `/dashboard/projects/${id}` : '/dashboard'} className={cn('flex items-center gap-1 rounded-md px-3 py-2 text-xs opacity-75 hover:opacity-100', top ? 'ml-auto' : 'md:mt-6')}>
                <ArrowLeft className="h-3 w-3" /> Project settings
              </Link>
            )}
            {!meta.isOwner && <Link href="/dashboard" className={cn('flex items-center gap-1 rounded-md px-3 py-2 text-xs opacity-75', top ? 'ml-auto' : 'md:mt-6')}><ArrowLeft className="h-3 w-3" /> My projects</Link>}
          </div>
        </aside>
        <main className="min-w-0 flex-1 bg-gray-50 p-4 md:p-8">
          {meta.preview && meta.project.category !== 'WEBSITE' && <Alert tone="info" className="mb-4">Preview mode — this workspace is fully working; publish the project to make it official for your team.</Alert>}
          {children}
        </main>
      </div>
    </WorkspaceCtx.Provider>
  );
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <MeProvider><RequireAuth><Shell>{children}</Shell></RequireAuth></MeProvider>;
}
