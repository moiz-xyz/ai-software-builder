'use client';
import { createContext, useContext } from 'react';
import type { EntityDef } from '@sf/templates';

export interface WorkspaceMeta {
  project: { id: string; name: string; category: string; status: string; slug: string };
  preview: boolean;
  config: { business: { name: string }; branding: { logo?: string; primaryColor: string; accentColor: string; font: string; layout: string; theme: string }; content: Record<string, unknown>; features: string[]; modules: string[] };
  entities: (EntityDef & { module: string; canRead: boolean; canWrite: boolean })[];
  permissions: string[];
  role: string | null;
  isOwner: boolean;
  canManageUsers: boolean;
}

export const WorkspaceCtx = createContext<WorkspaceMeta | null>(null);
export const useWorkspace = () => useContext(WorkspaceCtx)!;

