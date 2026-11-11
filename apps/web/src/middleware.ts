import { NextRequest, NextResponse } from 'next/server';

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localtest.me').toLowerCase();
const APP_HOSTS = new Set(['localhost', '127.0.0.1', ROOT, `www.${ROOT}`, `app.${ROOT}`, ...(process.env.APP_HOSTS || '').split(',').filter(Boolean)]);

/**
 * Host-based routing for published customer sites:
 *   <slug>.ROOT_DOMAIN  or a verified custom domain  →  /site-host/<host>/<path>
 * The platform itself is served on APP_HOSTS.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0].toLowerCase();
  const { pathname } = req.nextUrl;
  if (!host || APP_HOSTS.has(host) || pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/site-host/${host}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
