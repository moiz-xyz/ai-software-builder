import { randomBytes } from 'crypto';

export const token = (bytes = 18) => randomBytes(bytes).toString('base64url');

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project'
  );
}

export const RESERVED_SLUGS = new Set(['www', 'api', 'admin', 'app', 'mail', 'static', 'assets', 'preview', 'dashboard', 'ftp', 'smtp', 'ns1', 'ns2']);

export function bumpVersion(v: string, kind: 'major' | 'minor' | 'patch'): string {
  const [maj, min, pat] = (v || '0.0.0').split('.').map((n) => parseInt(n, 10) || 0);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}
