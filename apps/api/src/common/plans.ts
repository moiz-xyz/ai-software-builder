import type { Plan } from '@prisma/client';

export const PLAN_LIMITS: Record<Plan, { maxProjects: number; customDomains: boolean; maxWorkspaceUsers: number; storageMb: number }> = {
  FREE: { maxProjects: 1, customDomains: false, maxWorkspaceUsers: 3, storageMb: 100 },
  STARTER: { maxProjects: 3, customDomains: true, maxWorkspaceUsers: 10, storageMb: 1000 },
  PRO: { maxProjects: 20, customDomains: true, maxWorkspaceUsers: 50, storageMb: 10000 },
  ENTERPRISE: { maxProjects: 1000, customDomains: true, maxWorkspaceUsers: 10000, storageMb: 100000 },
};
