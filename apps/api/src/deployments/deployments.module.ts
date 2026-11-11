import { InjectQueue, BullModule, Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ProjectConfig } from '@sf/templates';
import { Job, Queue } from 'bullmq';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';

export const DEPLOY_QUEUE = 'deployments';

export function siteUrls(slug: string, previewToken: string) {
  const web = new URL(process.env.WEB_URL || 'http://localhost:3100');
  const root = process.env.ROOT_DOMAIN || 'localtest.me';
  const port = web.port ? `:${web.port}` : '';
  return {
    previewUrl: `${web.origin}/preview/${previewToken}`,
    liveUrl: `${web.protocol}//${slug}.${root}${port}`,
    pathUrl: `${web.origin}/s/${slug}`,
    workspaceUrl: `${web.origin}/workspace`,
  };
}

@Injectable()
export class DeploymentsService {
  constructor(private prisma: PrismaService, @InjectQueue(DEPLOY_QUEUE) private queue: Queue, private audit: AuditService) {}

  async enqueue(projectId: string, actorId: string) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const running = await this.prisma.deployment.findFirst({ where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } } });
    if (running) throw new BadRequestException('A deployment is already in progress for this project.');
    const deployment = await this.prisma.deployment.create({
      data: { projectId, configVersion: project.configVersion, triggeredById: actorId, log: [`Queued deployment of config v${project.configVersion}`] },
    });
    await this.prisma.project.update({ where: { id: projectId }, data: { status: 'PUBLISHING', approvedAt: project.approvedAt ?? new Date() } });
    await this.queue.add('deploy', { deploymentId: deployment.id }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 });
    await this.audit.log(actorId, 'project.deploy_queued', 'Project', projectId, { deploymentId: deployment.id, configVersion: project.configVersion });
    return deployment;
  }

  list(projectId?: string) {
    return this.prisma.deployment.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: projectId ? undefined : { project: { select: { id: true, name: true, slug: true, category: true } } },
    });
  }
}

/**
 * Deployment worker. Publishing never builds new code: it snapshots the project's
 * validated config, makes sure the isolated workspace (roles, owner membership) exists,
 * activates the platform subdomain and flips the project live.
 */
@Processor(DEPLOY_QUEUE)
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger(DeploymentProcessor.name);
  constructor(private prisma: PrismaService, private audit: AuditService) {
    super();
  }

  private async step(id: string, line: string) {
    await this.prisma.deployment.update({ where: { id }, data: { log: { push: `${new Date().toISOString()}  ${line}` } } });
  }

  async process(job: Job<{ deploymentId: string }>) {
    const id = job.data.deploymentId;
    const dep = await this.prisma.deployment.update({ where: { id }, data: { status: 'RUNNING', startedAt: new Date() }, include: { project: true } });
    const project = dep.project;
    try {
      await this.step(id, `Loading config v${dep.configVersion}`);
      const version = await this.prisma.projectConfigVersion.findUniqueOrThrow({ where: { projectId_version: { projectId: project.id, version: dep.configVersion } } });
      const config = version.config as unknown as ProjectConfig;

      if (project.category !== 'WEBSITE') {
        await this.step(id, 'Provisioning isolated workspace (roles & owner access)');
        for (const role of config.roles ?? []) {
          await this.prisma.projectRole.upsert({
            where: { projectId_key: { projectId: project.id, key: role.key } },
            create: { projectId: project.id, key: role.key, name: role.name, permissions: role.permissions },
            update: { name: role.name, permissions: role.permissions },
          });
        }
        const adminRole = await this.prisma.projectRole.findUniqueOrThrow({ where: { projectId_key: { projectId: project.id, key: 'admin' } } });
        await this.prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: project.id, userId: project.ownerId } },
          create: { projectId: project.id, userId: project.ownerId, roleId: adminRole.id },
          update: {},
        });
        await this.step(id, `Enabled modules: ${config.modules.join(', ')}`);
      } else {
        await this.step(id, `Rendering website with ${config.sections.filter((s) => s.enabled).length} sections, theme "${config.branding.theme}"`);
      }

      await this.step(id, 'Activating domains');
      const root = process.env.ROOT_DOMAIN || 'localtest.me';
      await this.prisma.domain.upsert({
        where: { hostname: `${project.slug}.${root}` },
        create: { projectId: project.id, hostname: `${project.slug}.${root}`, type: 'SUBDOMAIN', verified: true, sslStatus: 'ACTIVE', verificationToken: 'platform' },
        update: { verified: true, sslStatus: 'ACTIVE' },
      });
      const custom = await this.prisma.domain.findMany({ where: { projectId: project.id, type: 'CUSTOM' } });
      for (const d of custom) await this.step(id, `Custom domain ${d.hostname}: ${d.verified ? 'verified' : 'awaiting DNS verification'}, SSL ${d.sslStatus}`);

      await this.prisma.project.update({
        where: { id: project.id },
        data: { status: 'PUBLISHED', publishedConfig: config as unknown as Prisma.InputJsonValue, publishedVersion: dep.configVersion, publishedAt: new Date(), provisionedAt: project.provisionedAt ?? new Date(), rejectionReason: null },
      });
      await this.step(id, 'Live ✔');
      await this.prisma.deployment.update({ where: { id }, data: { status: 'SUCCEEDED', finishedAt: new Date() } });
      await this.audit.log(dep.triggeredById, 'project.published', 'Project', project.id, { deploymentId: id, configVersion: dep.configVersion });
    } catch (e: any) {
      this.logger.error(`Deployment ${id} failed: ${e?.message}`);
      await this.step(id, `ERROR: ${e?.message ?? e}`);
      const final = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (final) {
        await this.prisma.deployment.update({ where: { id }, data: { status: 'FAILED', finishedAt: new Date() } });
        await this.prisma.project.update({ where: { id: project.id }, data: { status: project.publishedVersion ? 'PUBLISHED' : 'APPROVED' } });
        await this.audit.log(dep.triggeredById, 'project.deploy_failed', 'Project', project.id, { deploymentId: id, error: String(e?.message ?? e) });
      }
      throw e;
    }
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: DEPLOY_QUEUE })],
  providers: [DeploymentsService, DeploymentProcessor],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
