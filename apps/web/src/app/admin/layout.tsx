'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { MeProvider, RequireAuth, TopNav } from '@/components/shell';
import { cn } from '@/lib/utils';

const NAV = [
  ['/admin', 'Overview'], ['/admin/projects', 'Projects'], ['/admin/customers', 'Customers'], ['/admin/subscriptions', 'Subscriptions'],
  ['/admin/templates', 'Master templates'], ['/admin/modules', 'Modules'], ['/admin/themes', 'Themes'], ['/admin/images', 'Image library'], ['/admin/assets', 'Assets'],
  ['/admin/deployments', 'Deployments'], ['/admin/domains', 'Domains'], ['/admin/audit', 'Audit log'],
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <MeProvider>
      <TopNav />
      <RequireAuth admin>
        <div className="container flex flex-col gap-6 py-6 md:flex-row">
          <nav className="flex shrink-0 flex-row flex-wrap gap-1 md:w-48 md:flex-col">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className={cn('rounded-md px-3 py-2 text-sm', (href === '/admin' ? path === href : path.startsWith(href)) ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}>{label}</Link>
            ))}
          </nav>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </RequireAuth>
    </MeProvider>
  );
}
