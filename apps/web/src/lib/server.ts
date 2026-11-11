
const API = process.env.API_INTERNAL_URL || 'http://localhost:4100';

/** Server-side fetch to the API (public rendering endpoints). */
export async function serverApi<T>(path: string): Promise<T | null> {
  const res = await fetch(API + path, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}
