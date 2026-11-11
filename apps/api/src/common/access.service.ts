import { ForbiddenException, Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import type { Project } from '@prisma/client';
import type { AuthUser } from './decorators';
import { PrismaService } from './prisma.service';

export interface ProjectAccess {
  project: Project;
  isOwner: boolean;
  isPlatformAdmin: boolean;
  permissions: string[];
  roleKey: string | null;
}

/** Permission strings: "*", "*:read", "<module>:*", "<module>:read", "<module>:write", "users:manage". */
export function hasPermission(perms: string[], module: string, action: 'read' | 'write' | 'manage'): boolean {
  return perms.some((p) => {
    if (p === '*') return true;
    const [m, a] = p.split(':');
    const moduleOk = m === '*' || m === module;
    const actionOk = a === '*' || a === action || (action === 'read' && a === 'write');
    return moduleOk && actionOk;
  });
}

/**
 * Single choke point for tenant isolation. Every project-scoped route resolves access
 * here; a customer can only reach projects they own or are a member of.
 */
@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  async resolve(projectId: string, user: AuthUser): Promise<ProjectAccess> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');
    const isPlatformAdmin = user.role === 'ADMIN';
    const isOwner = project.ownerId === user.id;
    if (isOwner || isPlatformAdmin) return { project, isOwner, isPlatformAdmin, permissions: ['*'], roleKey: 'admin' };
    const member = await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, include: { role: true } });
    // Do not reveal that the project exists.
    if (!member) throw new NotFoundException('Project not found.');
    return { project, isOwner: false, isPlatformAdmin: false, permissions: member.role.permissions, roleKey: member.role.key };
  }

  /** Owner (or platform admin) only: configuration, publishing, domains, members. */
  async owner(projectId: string, user: AuthUser): Promise<ProjectAccess> {
    const access = await this.resolve(projectId, user);
    if (!access.isOwner && !access.isPlatformAdmin) throw new ForbiddenException('Only the project owner can do this.');
    return access;
  }

  async require(projectId: string, user: AuthUser, module: string, action: 'read' | 'write' | 'manage'): Promise<ProjectAccess> {
    const access = await this.resolve(projectId, user);
    if (!hasPermission(access.permissions, module, action)) throw new ForbiddenException(`Your role does not allow ${action} access to ${module}.`);
    return access;
  }
}

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}
