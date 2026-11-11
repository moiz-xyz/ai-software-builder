'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ValidationIssue } from '@sf/templates';

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues: ValidationIssue[] = [], public body?: unknown) {
    super(message);
  }
}

/** Browser → same-origin /api/* (proxied to NestJS by next.config rewrites). */
export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(' ') : data?.message || res.statusText;
    throw new ApiError(res.status, msg, data?.issues ?? [], data);
  }
  return data as T;
}

export async function upload(file: File, opts: { projectId?: string; kind?: string; templateId?: string } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  const q = new URLSearchParams();
  if (opts.projectId) q.set('projectId', opts.projectId);
  if (opts.kind) q.set('kind', opts.kind);
  if (opts.templateId) q.set('templateId', opts.templateId);
  return api<{ id: string; url: string; ref: string; originalName: string }>(`/assets?${q}`, { method: 'POST', body: fd });
}

/** Tiny SWR-like hook. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(!!path);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(undefined);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

export interface Me {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER';
  company?: string;
  subscription?: { plan: string; status: string };
  limits: { maxProjects: number; customDomains: boolean; maxWorkspaceUsers: number };
}
