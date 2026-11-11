import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import {
  buildProjectConfig,
  collectAssetRefs,
  collectStockRefs,
  deriveNavigation,
  mapStrings,
  ProjectConfig,
  TemplateDefinition,
  validateConfig,
  validateSubmission,
} from '@sf/templates';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { promises as dns } from 'dns';
import { AccessService } from '../common/access.service';
import { AuditService } from '../common/audit.service';
import type { AuthUser } from '../common/decorators';
import { validationFailed } from '../common/errors';
import { PLAN_LIMITS } from '../common/plans';
import { PrismaService } from '../common/prisma.service';
import { RESERVED_SLUGS, slugify, token } from '../common/util';
import { DeploymentsService, siteUrls } from '../deployments/deployments.module';
import { LibraryService } from '../library/library.service';
import { StorageService } from '../storage/storage.service';

const json = (v: unknown) => v as Prisma.InputJsonValue;
const HOSTNAME = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export interface CreateProjectInput {
  templateKey: string;
  values: Record<string, unknown>;
  notes?: string;
  slug?: string;
  /** Original Instant Builder description (stored for the admin, never re-interpreted server-side). */
  prompt?: string;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private audit: AuditService,
    private library: LibraryService,
    private storage: StorageService,
    private deployments: DeploymentsService,
  ) {}

  private async planFor(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (sub && (sub.status === 'CANCELLED' || sub.status === 'PAST_DUE')) throw new ForbiddenException(`Your subscription is ${sub.status.toLowerCase().replace('_', ' ')}.`);
    return PLAN_LIMITS[sub?.plan ?? 'FREE'];
  }

  private async uniqueSlug(base: string, explicit: boolean): Promise<string> {
    const s = slugify(base);
    if (explicit) {
      if (RESERVED_SLUGS.has(s) || (await this.prisma.project.findUnique({ where: { slug: s } }))) throw new ConflictException(`The subdomain "${s}" is not available.`);
      return s;
    }
    for (let i = 1; i < 200; i++) {
      const candidate = i === 1 ? s : `${s}-${i}`;
      if (!RESERVED_SLUGS.has(candidate) && !(await this.prisma.project.findUnique({ where: { slug: candidate } }))) return candidate;
    }
    return `${s}-${randomBytes(3).toString('hex')}`;
  }

  /** Customer image URLs must belong to this project (or be shared template assets). */
  private assertOwnAssets(projectId: string, config: unknown) {
    mapStrings(config, (s) => {
      const m = /^\/api\/files\/([a-z]+)\/([^/]+)\//.exec(s);
      if (m && !(m[1] === 'templates' || (m[1] === 'projects' && m[2] === projectId))) {
        throw validationFailed('Configuration references files that do not belong to this project.', [{ path: 'images', code: 'invalid_value', message: 'Upload images to this project before using them.' }]);
      }
      return s;
    });
  }

  // ------------------------------------------------------------------ create

  /**
   * Customer submits the requirements form → a brand-new, independent project instance:
   * pinned template version, its own config, copied assets, roles, membership and subdomain.
   * The master template is only read, never written.
   */
  async create(user: AuthUser, input: CreateProjectInput) {
    if (!input?.templateKey || typeof input.values !== 'object' || input.values === null) throw new BadRequestException('templateKey and values are required.');
    if (input.notes && input.notes.length > 5000) throw new BadRequestException('Additional instructions must be under 5000 characters.');
    if (input.prompt !== undefined && (typeof input.prompt !== 'string' || input.prompt.length > 5000)) throw new BadRequestException('The business description must be under 5000 characters.');

    const limits = await this.planFor(user.id);
    const count = await this.prisma.project.count({ where: { ownerId: user.id } });
    if (user.role !== 'ADMIN' && count >= limits.maxProjects) throw new ForbiddenException(`Your plan allows ${limits.maxProjects} project(s). Upgrade to create more.`);

    const template = await this.prisma.template.findFirst({ where: { key: input.templateKey, status: 'PUBLISHED' }, include: { currentVersion: true } });
    if (!template?.currentVersion) throw new NotFoundException('Template not found or not published.');
    const def = template.currentVersion.definition as unknown as TemplateDefinition;
    const ctx = await this.library.context();

    const result = validateSubmission(def, { values: input.values }, ctx);
    if (!result.valid) throw validationFailed('Please fix the highlighted fields.', result.errors, result.warnings);

    // Resolve uploaded staging assets (must be the customer's own uploads).
    const refs = collectAssetRefs(input.values);
    const staged = refs.length ? await this.prisma.asset.findMany({ where: { id: { in: refs }, ownerId: user.id } }) : [];
    const missing = refs.filter((r) => !staged.some((a) => a.id === r));
    if (missing.length) throw validationFailed('Some uploaded files could not be found. Please upload them again.', missing.map((m) => ({ path: 'assets', code: 'invalid_value', message: `File ${m} not found.` })));

    // Library photos chosen by the Instant Builder (must be active library items).
    const stockRefs = collectStockRefs(input.values);
    const stock = stockRefs.length ? await this.prisma.stockImage.findMany({ where: { id: { in: stockRefs }, active: true } }) : [];
    const missingStock = stockRefs.filter((r) => !stock.some((x) => x.id === r));
    if (missingStock.length) throw validationFailed('Some library photos are no longer available. Please pick other photos.', missingStock.map((m) => ({ path: 'images', code: 'invalid_value', message: `Library photo ${m} is not available.` })));

    const businessName = String((input.values.businessName ?? input.values.companyName ?? template.name) as string);
    const slug = await this.uniqueSlug(input.slug || businessName, !!input.slug);
    const projectId = 'p' + randomBytes(12).toString('hex');

    // Copy every referenced file into the project's own storage prefix.
    const urlByRef = new Map<string, string>();
    const copied: { key: string; data: Prisma.AssetCreateManyInput }[] = [];
    try {
      for (const a of staged) {
        const ext = a.key.split('.').pop();
        const key = `projects/${projectId}/${randomUUID()}.${ext}`;
        await this.storage.copy(a.key, key);
        const url = this.storage.urlFor(key);
        urlByRef.set(`asset:${a.id}`, url);
        copied.push({ key, data: { ownerId: user.id, projectId, kind: a.kind, key, url, mimeType: a.mimeType, size: a.size, originalName: a.originalName } });
      }
      for (const img of stock) {
        const ext = img.key.split('.').pop();
        const key = `projects/${projectId}/${randomUUID()}.${ext}`;
        await this.storage.copy(img.key, key);
        const url = this.storage.urlFor(key);
        urlByRef.set(`stock:${img.id}`, url);
        copied.push({ key, data: { ownerId: user.id, projectId, kind: 'image', key, url, mimeType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', size: img.size, originalName: `Library: ${img.title}`.slice(0, 200) } });
      }
    } catch (e) {
      await Promise.all(copied.map((c) => this.storage.delete(c.key).catch(() => undefined)));
      throw e;
    }
    const resolvedValues = mapStrings(input.values, (s) => urlByRef.get(s) ?? s) as Record<string, unknown>;
    const config = buildProjectConfig(def, { values: resolvedValues }, ctx);
    const previewToken = token(24);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.project.create({
          data: {
            id: projectId,
            ownerId: user.id,
            name: config.business.name,
            slug,
            category: template.category,
            templateId: template.id,
            templateVersionId: template.currentVersion!.id,
            status: 'PREVIEW_READY',
            requirements: json(resolvedValues),
            customerNotes: input.notes?.trim() || null,
            sourcePrompt: input.prompt?.trim() || null,
            config: json(config),
            configVersion: 1,
            previewToken,
          },
        });
        await tx.projectConfigVersion.create({ data: { projectId, version: 1, config: json(config), message: input.prompt ? 'Created with the Instant Builder' : 'Created from requirements form', createdById: user.id } });
        if (copied.length) await tx.asset.createMany({ data: copied.map((c) => c.data) });
        const roles = config.roles.length ? config.roles : [{ key: 'admin', name: 'Administrator', permissions: ['*'] }];
        for (const r of roles) await tx.projectRole.create({ data: { projectId, key: r.key, name: r.name, permissions: r.permissions } });
        const adminRole = await tx.projectRole.findUniqueOrThrow({ where: { projectId_key: { projectId, key: 'admin' } } });
        await tx.projectMember.create({ data: { projectId, userId: user.id, roleId: adminRole.id } });
        await tx.domain.create({
          data: { projectId, hostname: `${slug}.${process.env.ROOT_DOMAIN || 'localtest.me'}`, type: 'SUBDOMAIN', verified: true, sslStatus: 'PENDING', verificationToken: 'platform' },
        });
      });
    } catch (e) {
      await Promise.all(copied.map((c) => this.storage.delete(c.key).catch(() => undefined)));
      throw e;
    }

    await this.audit.log(user.id, 'project.create', 'Project', projectId, { template: template.key, version: template.currentVersion.version, slug, via: input.prompt ? 'instant-builder' : 'form', libraryPhotos: stock.length });
    return { ...(await this.get(projectId, user)), warnings: result.warnings };
  }

  // ------------------------------------------------------------------ read

  async listMine(user: AuthUser) {
    const rows = await this.prisma.project.findMany({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      orderBy: { updatedAt: 'desc' },
      include: { template: { select: { key: true, name: true } }, templateVersion: { select: { version: true } } },
    });
    return rows.map((p) => this.present(p, user));
  }

  private present(p: Project & Record<string, unknown>, user: AuthUser) {
    const { previewToken, ...rest } = p;
    const isOwner = p.ownerId === user.id || user.role === 'ADMIN';
    return {
      ...rest,
      isOwner,
      hasUnpublishedChanges: p.publishedVersion !== null && p.publishedVersion !== p.configVersion,
      urls: isOwner ? siteUrls(p.slug, previewToken) : { workspaceUrl: siteUrls(p.slug, '').workspaceUrl },
    };
  }

  async get(id: string, user: AuthUser) {
    const acc = await this.access.resolve(id, user);
    const p = await this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        template: { select: { id: true, key: true, name: true, currentVersion: { select: { version: true } } } },
        templateVersion: { select: { id: true, version: true, definition: true } },
        domains: { orderBy: { createdAt: 'asc' } },
        deployments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    const out = this.present(p as never, user);
    if (!acc.isOwner && !acc.isPlatformAdmin) {
      // Workspace members see branding/modules, not requirements or admin notes.
      return { id: p.id, name: p.name, category: p.category, status: p.status, slug: p.slug, config: p.publishedConfig ?? p.config, templateVersion: { version: p.templateVersion.version, definition: p.templateVersion.definition }, isOwner: false, urls: out.urls };
    }
    const ctx = await this.library.context();
    const def = p.templateVersion.definition as unknown as TemplateDefinition;
    return {
      ...out,
      themes: def.themes.map((k) => ctx.themes.find((t) => t.key === k)).filter(Boolean),
      modulesInfo: def.modules.map((k) => ctx.modules.find((m) => m.key === k)).filter(Boolean),
      domainInstructions: { cnameTarget: process.env.PUBLIC_INGRESS_HOST || 'ingress.example.com', txtPrefix: '_factory-verify' },
    };
  }

  // ------------------------------------------------------------------ config & versions

  private async saveConfig(project: Project, config: ProjectConfig, message: string, actorId: string) {
    const def = await this.library.definitionForVersion(project.templateVersionId);
    const ctx = await this.library.context();
    if (def.category === 'WEBSITE') {
      // Navigation always follows the enabled sections; labels may be customised.
      const labels = new Map((config.navigation ?? []).map((n) => [n.section, n.label]));
      config.navigation = deriveNavigation(def, config.sections ?? []).map((n) => ({ ...n, label: (labels.get(n.section) || n.label).slice(0, 40) }));
    } else {
      config.roles = (config.roles ?? []).filter((r) => def.roles.some((d) => d.key === r.key)).map((r) => def.roles.find((d) => d.key === r.key)!);
      if (!config.roles.some((r) => r.key === 'admin')) config.roles.unshift(def.roles.find((r) => r.key === 'admin')!);
    }
    const result = validateConfig(def, config, ctx);
    if (!result.valid) throw validationFailed('This configuration is not supported by the template.', result.errors, result.warnings);
    this.assertOwnAssets(project.id, config);

    const next = project.configVersion + 1;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Optimistic concurrency: only bump if nobody saved in between.
      const res = await tx.project.updateMany({ where: { id: project.id, configVersion: project.configVersion }, data: { config: json(config), configVersion: next, name: config.business.name } });
      if (res.count !== 1) throw new ConflictException('This project was changed elsewhere. Reload to get the latest version.');
      await tx.projectConfigVersion.create({ data: { projectId: project.id, version: next, config: json(config), message: message.slice(0, 200), createdById: actorId } });
      for (const r of config.roles ?? []) {
        await tx.projectRole.upsert({
          where: { projectId_key: { projectId: project.id, key: r.key } },
          create: { projectId: project.id, key: r.key, name: r.name, permissions: r.permissions },
          update: {},
        });
      }
      return tx.project.findUniqueOrThrow({ where: { id: project.id } });
    });
    await this.audit.log(actorId, 'project.config_update', 'Project', project.id, { version: next, message });
    return { configVersion: updated.configVersion, config: updated.config, warnings: result.warnings };
  }

  async updateConfig(id: string, user: AuthUser, body: { config: ProjectConfig; message?: string; baseVersion?: number }) {
    const { project } = await this.access.owner(id, user);
    if (!body?.config) throw new BadRequestException('config is required.');
    if (body.baseVersion !== undefined && body.baseVersion !== project.configVersion) throw new ConflictException('This project was changed elsewhere. Reload to get the latest version.');
    return this.saveConfig(project, body.config, body.message || 'Edited in visual editor', user.id);
  }

  async versions(id: string, user: AuthUser) {
    await this.access.owner(id, user);
    return this.prisma.projectConfigVersion.findMany({ where: { projectId: id }, orderBy: { version: 'desc' }, select: { id: true, version: true, message: true, createdAt: true, createdById: true } });
  }

  async version(id: string, version: number, user: AuthUser) {
    await this.access.owner(id, user);
    const v = await this.prisma.projectConfigVersion.findUnique({ where: { projectId_version: { projectId: id, version } } });
    if (!v) throw new NotFoundException('Version not found.');
    return v;
  }

  /** Restoring creates a new version, so history is never lost (this is also "undo" across sessions). */
  async restore(id: string, version: number, user: AuthUser) {
    const { project } = await this.access.owner(id, user);
    const v = await this.prisma.projectConfigVersion.findUnique({ where: { projectId_version: { projectId: id, version } } });
    if (!v) throw new NotFoundException('Version not found.');
    return this.saveConfig(project, v.config as unknown as ProjectConfig, `Restored version ${version}`, user.id);
  }

  async undo(id: string, user: AuthUser) {
    const { project } = await this.access.owner(id, user);
    if (project.configVersion <= 1) throw new BadRequestException('Nothing to undo.');
    return this.restore(id, project.configVersion - 1, user);
  }

  // ------------------------------------------------------------------ approval & publishing

  async approve(id: string, user: AuthUser) {
    const { project } = await this.access.owner(id, user);
    if (['PUBLISHING', 'AWAITING_APPROVAL'].includes(project.status)) throw new BadRequestException(`Project is already ${project.status.toLowerCase().replace('_', ' ')}.`);
    if (project.status === 'PUBLISHED' && project.publishedVersion === project.configVersion) throw new BadRequestException('The latest version is already live.');
    await this.audit.log(user.id, 'project.customer_approved', 'Project', id, { configVersion: project.configVersion });
    if (process.env.REQUIRE_ADMIN_APPROVAL === 'true' && user.role !== 'ADMIN') {
      await this.prisma.project.update({ where: { id }, data: { status: 'AWAITING_APPROVAL', approvedAt: new Date() } });
      return { status: 'AWAITING_APPROVAL', message: 'Thanks! An administrator will review and publish your project.' };
    }
    const dep = await this.deployments.enqueue(id, user.id);
    return { status: 'PUBLISHING', deployment: dep };
  }

  async unpublish(id: string, user: AuthUser) {
    const { project } = await this.access.owner(id, user);
    if (project.status !== 'PUBLISHED') throw new BadRequestException('Project is not published.');
    await this.prisma.project.update({ where: { id }, data: { status: 'UNPUBLISHED' } });
    await this.audit.log(user.id, 'project.unpublished', 'Project', id);
    return { status: 'UNPUBLISHED' };
  }

  async deploymentsFor(id: string, user: AuthUser) {
    await this.access.owner(id, user);
    return this.deployments.list(id);
  }

  // ------------------------------------------------------------------ domains

  async addDomain(id: string, user: AuthUser, hostnameRaw: string) {
    const { project } = await this.access.owner(id, user);
    const limits = await this.planFor(project.ownerId);
    if (!limits.customDomains && user.role !== 'ADMIN') throw new ForbiddenException('Custom domains are available on paid plans.');
    const hostname = String(hostnameRaw || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!HOSTNAME.test(hostname)) throw new BadRequestException('Enter a valid domain like www.example.com.');
    const root = process.env.ROOT_DOMAIN || 'localtest.me';
    if (hostname === root || hostname.endsWith(`.${root}`)) throw new BadRequestException('Platform subdomains are managed automatically.');
    if (await this.prisma.domain.findUnique({ where: { hostname } })) throw new ConflictException('This domain is already connected to a project.');
    const d = await this.prisma.domain.create({ data: { projectId: id, hostname, type: 'CUSTOM', verificationToken: token(16) } });
    await this.audit.log(user.id, 'domain.add', 'Project', id, { hostname });
    return d;
  }

  /** Real DNS check: TXT _factory-verify.<host> must contain the token. */
  async verifyDomain(id: string, domainId: string, user: AuthUser) {
    await this.access.owner(id, user);
    const d = await this.prisma.domain.findFirst({ where: { id: domainId, projectId: id } });
    if (!d) throw new NotFoundException();
    if (d.type !== 'CUSTOM') return d;
    let verified = false;
    let detail = '';
    try {
      const records = (await dns.resolveTxt(`_factory-verify.${d.hostname}`)).map((r) => r.join(''));
      verified = records.includes(d.verificationToken);
      detail = verified ? 'TXT record found' : `TXT record found but value does not match (got ${records.join(', ') || 'nothing'})`;
    } catch (e: any) {
      detail = `TXT record not found (${e?.code ?? 'lookup failed'})`;
    }
    const updated = await this.prisma.domain.update({ where: { id: d.id }, data: { verified, lastCheckedAt: new Date(), sslStatus: verified ? d.sslStatus : 'PENDING' } });
    await this.audit.log(user.id, 'domain.verify', 'Project', id, { hostname: d.hostname, verified, detail });
    return { ...updated, detail };
  }

  async removeDomain(id: string, domainId: string, user: AuthUser) {
    await this.access.owner(id, user);
    const d = await this.prisma.domain.findFirst({ where: { id: domainId, projectId: id } });
    if (!d) throw new NotFoundException();
    if (d.type === 'SUBDOMAIN') throw new BadRequestException('The platform subdomain can not be removed.');
    await this.prisma.domain.delete({ where: { id: d.id } });
    await this.audit.log(user.id, 'domain.remove', 'Project', id, { hostname: d.hostname });
    return { ok: true };
  }

  // ------------------------------------------------------------------ members (CRM / ERP workspace users)

  async members(id: string, user: AuthUser) {
    await this.access.require(id, user, 'users', 'manage');
    const [members, roles] = await Promise.all([
      this.prisma.projectMember.findMany({ where: { projectId: id }, include: { user: { select: { id: true, email: true, name: true } }, role: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.projectRole.findMany({ where: { projectId: id }, orderBy: { name: 'asc' } }),
    ]);
    return { members, roles };
  }

  async addMember(id: string, user: AuthUser, body: { email: string; name?: string; roleKey: string }) {
    const { project } = await this.access.require(id, user, 'users', 'manage');
    if (project.category === 'WEBSITE') throw new BadRequestException('Websites do not have workspace users.');
    const email = String(body?.email || '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Valid email required.');
    const role = await this.prisma.projectRole.findUnique({ where: { projectId_key: { projectId: id, key: body.roleKey } } });
    if (!role) throw new BadRequestException('Unknown role.');
    const limits = await this.planFor(project.ownerId);
    if ((await this.prisma.projectMember.count({ where: { projectId: id } })) >= limits.maxWorkspaceUsers) throw new ForbiddenException(`Your plan allows ${limits.maxWorkspaceUsers} workspace users.`);

    let tempPassword: string | undefined;
    let target = await this.prisma.user.findUnique({ where: { email } });
    if (!target) {
      tempPassword = token(9);
      target = await this.prisma.user.create({ data: { email, name: body.name?.trim() || email.split('@')[0], passwordHash: await bcrypt.hash(tempPassword, 10) } });
    }
    if (await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: id, userId: target.id } } })) throw new ConflictException('This user is already a member.');
    const m = await this.prisma.projectMember.create({ data: { projectId: id, userId: target.id, roleId: role.id }, include: { user: { select: { id: true, email: true, name: true } }, role: true } });
    await this.audit.log(user.id, 'member.add', 'Project', id, { email, role: role.key });
    return { member: m, tempPassword };
  }

  async updateMember(id: string, memberId: string, user: AuthUser, roleKey: string) {
    const { project } = await this.access.require(id, user, 'users', 'manage');
    const m = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId: id } });
    if (!m) throw new NotFoundException();
    if (m.userId === project.ownerId) throw new BadRequestException("The owner's role can not be changed.");
    const role = await this.prisma.projectRole.findUnique({ where: { projectId_key: { projectId: id, key: roleKey } } });
    if (!role) throw new BadRequestException('Unknown role.');
    await this.audit.log(user.id, 'member.update', 'Project', id, { memberId, role: roleKey });
    return this.prisma.projectMember.update({ where: { id: memberId }, data: { roleId: role.id }, include: { role: true } });
  }

  async removeMember(id: string, memberId: string, user: AuthUser) {
    const { project } = await this.access.require(id, user, 'users', 'manage');
    const m = await this.prisma.projectMember.findFirst({ where: { id: memberId, projectId: id } });
    if (!m) throw new NotFoundException();
    if (m.userId === project.ownerId) throw new BadRequestException('The owner can not be removed.');
    await this.prisma.projectMember.delete({ where: { id: memberId } });
    await this.audit.log(user.id, 'member.remove', 'Project', id, { memberId });
    return { ok: true };
  }
}
