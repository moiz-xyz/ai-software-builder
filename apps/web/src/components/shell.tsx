'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect } from 'react';
import { Factory } from 'lucide-react';
import { api, Me, useApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

const MeCtx = createContext<{ me?: Me; loading: boolean; reload: () => void }>({ loading: true, reload: () => {} });
export const useMe = () => useContext(MeCtx);

export function MeProvider({ children }: { children: ReactNode }) {
  const { data, loading, reload } = useApi<Me>('/auth/me');
  return <MeCtx.Provider value={{ me: data, loading, reload }}>{children}</MeCtx.Provider>;
}

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { me, loading } = useMe();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!loading && !me) router.replace(`/login?next=${encodeURIComponent(path)}`);
    if (!loading && me && admin && me.role !== 'ADMIN') router.replace('/dashboard');
  }, [loading, me, admin, router, path]);
  if (loading || !me || (admin && me.role !== 'ADMIN')) return <Loading />;
  return <>{children}</>;
}

export function TopNav() {
  const { me, reload } = useMe();
  const router = useRouter();
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link href={href} className={cn('text-sm transition hover:text-foreground', path.startsWith(href) ? 'font-medium text-foreground' : 'text-muted-foreground')}>
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Factory className="h-5 w-5" /> SiteFactory
          </Link>
          <nav className="hidden items-center gap-5 sm:flex">
            {link('/build', 'Instant Builder')}
            {link('/templates', 'Templates')}
            {me && link('/dashboard', 'My projects')}
            {me?.role === 'ADMIN' && link('/admin', 'Admin')}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {me ? (
            <>
              <span className="hidden text-sm text-muted-foreground md:inline">{me.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await api('/auth/logout', { method: 'POST' });
                  reload();
                  router.push('/');
                }}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
              <Link href="/register"><Button size="sm">Get started</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <MeProvider>
      <TopNav />
      <main className="container py-8">{children}</main>
    </MeProvider>
  );
}
