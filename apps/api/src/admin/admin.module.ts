import { BadRequestException, Body, ConflictException, Controller, DefaultValuePipe, Delete, Get, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Plan, Prisma, ProjectStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import type { EntityDef, ThemeDef } from '@sf/templates';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { PLAN_LIMITS } from '../common/plans';
import { PrismaService } from '../common/prisma.service';
import { DeploymentsModule, DeploymentsService, siteUrls } from '../deployments/deployments.module';
import { LibraryService } from '../library/library.service';
import { StorageService } from '../storage/storage.service';

const json = (v: unknown) => v as Prisma.InputJsonValue;
const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private deployments: DeploymentsService,
    private library: LibraryService,
    private storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ overview
  @Get('stats')
  async stats() {
    const [customers, projects, byStatus, byCategory, templates, deploymentsFailed, awaiting, recent] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.project.count(),
      this.prisma.project.groupBy({ by: ['status'], _count: true }),
      this.prisma.project.groupBy({ by: ['category'], _count: true }),
      this.prisma.template.groupBy({ by: ['status'], _count: true }),
      this.prisma.deployment.count({ where: { status: 'FAILED' } }),
      this.prisma.project.count({ where: { status: 'AWAITING_APPROVAL' } }),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { email: true } } } }),
    ]);
    return {
      customers, projects, deploymentsFailed, awaitingApproval: awaiting,
      projectsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      projectsByCategory: Object.fromEntries(byCategory.map((r) => [r.category, r._count])),
      templatesByStatus: Object.fromEntries(templates.map((r) => [r.status, r._count])),
      recentActivity: recent,
    };
  }

  // ------------------------------------------------------------------ customers
  @Get('customers')
  customers(@Query('q') q?: string) {
    return this.prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }] } : {},
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, company: true, role: true, status: true, createdAt: true, subscription: true, _count: { select: { projects: true } } },
    });
  }

  @Get('customers/:id')
  async customer(@Param('id') id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, company: true, phone: true, role: true, status: true, createdAt: true, subscription: true,
        projects: { orderBy: { createdAt: 'desc' }, select: { id: true, name: true, slug: true, category: true, status: true, createdAt: true, template: { select: { name: true } } } },
        memberships: { select: { project: { select: { id: true, name: true } }, role: { select: { name: true } } } },
      },
    });
    if (!u) throw new NotFoundException();
    const logs = await this.prisma.auditLog.findMany({ where: { actorId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { ...u, limits: PLAN_LIMITS[u.subscription?.plan ?? 'FREE'], logs };
  }

  @Patch('customers/:id')
  async updateCustomer(@Param('id') id: string, @Body() body: { status?: UserStatus; role?: 'ADMIN' | 'CUSTOMER' }, @CurrentUser() me: AuthUser) {
    if (id === me.id) throw new BadRequestException('You can not change your own account here.');
    const data: Prisma.UserUpdateInput = {};
    if (body.status) {
      if (!Object.values(UserStatus).includes(body.status)) throw new BadRequestException('Invalid status');
      data.status = body.status;
    }
    if (body.role) data.role = body.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
    const u = await this.prisma.user.update({ where: { id }, data, select: { id: true, status: true, role: true } });
    await this.audit.log(me.id, 'admin.customer_update', 'User', id, body as Record<string, unknown>);
    return u;
  }

  // ------------------------------------------------------------------ subscriptions
  @Get('subscriptions')
  subscriptions() {
    return this.prisma.subscription.findMany({ orderBy: { updatedAt: 'desc' }, include: { user: { select: { id: true, email: true, name: true, _count: { select: { projects: true } } } } } });
  }

  @Get('plans')
  plans() {
    return PLAN_LIMITS;
  }

  @Put('subscriptions/:userId')
  async setSubscription(@Param('userId') userId: string, @Body() body: { plan: Plan; status: SubscriptionStatus; currentPeriodEnd?: string | null; notes?: string }, @CurrentUser() me: AuthUser) {
    if (!Object.values(Plan).includes(body.plan) || !Object.values(SubscriptionStatus).includes(body.status)) throw new BadRequestException('Invalid plan or status.');
    const data = { plan: body.plan, status: body.status, currentPeriodEnd: body.currentPeriodEnd ? new Date(body.currentPeriodEnd) : null, notes: body.notes?.slice(0, 1000) };
    const s = await this.prisma.subscription.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await this.audit.log(me.id, 'admin.subscription_update', 'User', userId, { plan: body.plan, status: body.status });
    return s;
  }

  // ------------------------------------------------------------------ projects
  @Get('projects')
  projects(@Query('status') status?: ProjectStatus, @Query('category') category?: string, @Query('q') q?: string) {
    return this.prisma.project.findMany({
      where: {
        ...(status && Object.values(ProjectStatus).includes(status) ? { status } : {}),
        ...(category && ['WEBSITE', 'CRM', 'ERP'].includes(category) ? { category: category as 'WEBSITE' } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { owner: { select: { id: true, email: true, name: true } }, template: { select: { name: true, key: true } }, templateVersion: { select: { version: true } } },
    });
  }

  @Get('projects/:id')
  async project(@Param('id') id: string) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, name: true, company: true } },
        template: { select: { id: true, name: true, key: true, currentVersion: { select: { version: true } } } },
        templateVersion: { select: { id: true, version: true, definition: true } },
        domains: true,
        deployments: { orderBy: { createdAt: 'desc' }, take: 20 },
        configVersions: { orderBy: { version: 'desc' }, select: { version: true, message: true, createdAt: true } },
        assets: { orderBy: { createdAt: 'desc' } },
        members: { include: { user: { select: { email: true, name: true } }, role: { select: { name: true, key: true } } } },
        roles: true,
        _count: { select: { records: true } },
      },
    });
    if (!p) throw new NotFoundException();
    const logs = await this.prisma.auditLog.findMany({ where: { entityType: 'Project', entityId: id }, orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { email: true } } } });
    const recordCounts = await this.prisma.workspaceRecord.groupBy({ by: ['entity'], where: { projectId: id }, _count: true });
    return { ...p, urls: siteUrls(p.slug, p.previewToken), logs, recordCounts: Object.fromEntries(recordCounts.map((r) => [r.entity, r._count])) };
  }

  @Post('projects/:id/approve')
  async approve(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const p = await this.prisma.project.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    await this.audit.log(me.id, 'admin.project_approved', 'Project', id);
    return this.deployments.enqueue(id, me.id);
  }

  @Post('projects/:id/reject')
  async reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() me: AuthUser) {
    const p = await this.prisma.project.update({ where: { id }, data: { status: 'REJECTED', rejectionReason: (reason || 'No reason given').slice(0, 1000) } });
    await this.audit.log(me.id, 'admin.project_rejected', 'Project', id, { reason });
    return p;
  }

  @Post('projects/:id/unpublish')
  async unpublish(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const p = await this.prisma.project.update({ where: { id }, data: { status: 'UNPUBLISHED' } });
    await this.audit.log(me.id, 'admin.project_unpublished', 'Project', id);
    return p;
  }

  @Patch('projects/:id/notes')
  async notes(@Param('id') id: string, @Body('adminNotes') adminNotes: string, @CurrentUser() me: AuthUser) {
    const p = await this.prisma.project.update({ where: { id }, data: { adminNotes: (adminNotes ?? '').slice(0, 5000) } });
    await this.audit.log(me.id, 'admin.project_notes', 'Project', id);
    return p;
  }

  // ------------------------------------------------------------------ deployments / domains / assets / audit
  @Get('deployments')
  deploymentsList() {
    return this.deployments.list();
  }

  @Post('deployments/:id/retry')
  async retry(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const d = await this.prisma.deployment.findUnique({ where: { id } });
    if (!d) throw new NotFoundException();
    return this.deployments.enqueue(d.projectId, me.id);
  }

  @Get('domains')
  domains() {
    return this.prisma.domain.findMany({ orderBy: { createdAt: 'desc' }, include: { project: { select: { id: true, name: true, status: true } } } });
  }

  @Patch('domains/:id')
  async updateDomain(@Param('id') id: string, @Body() body: { verified?: boolean; sslStatus?: 'PENDING' | 'ACTIVE' | 'FAILED' }, @CurrentUser() me: AuthUser) {
    const d = await this.prisma.domain.update({ where: { id }, data: { ...(body.verified !== undefined ? { verified: !!body.verified } : {}), ...(body.sslStatus ? { sslStatus: body.sslStatus } : {}) } });
    await this.audit.log(me.id, 'admin.domain_update', 'Project', d.projectId, { hostname: d.hostname, ...body });
    return d;
  }

  @Get('assets')
  assets(@Query('projectId') projectId?: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1) {
    return this.prisma.asset.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: 'desc' },
      skip: (Math.max(1, page) - 1) * 100,
      take: 100,
      include: { owner: { select: { email: true } }, project: { select: { name: true } } },
    });
  }

  @Delete('assets/:id')
  async deleteAsset(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const a = await this.prisma.asset.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    await this.storage.delete(a.key).catch(() => undefined);
    await this.prisma.asset.delete({ where: { id } });
    await this.audit.log(me.id, 'admin.asset_delete', 'Asset', id, { key: a.key });
    return { ok: true };
  }

  @Get('audit-logs')
  auditLogs(@Query('entityType') entityType?: string, @Query('action') action?: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1) {
    return this.prisma.auditLog.findMany({
      where: { ...(entityType ? { entityType } : {}), ...(action ? { action: { contains: action } } : {}) },
      orderBy: { createdAt: 'desc' },
      skip: (Math.max(1, page) - 1) * 100,
      take: 100,
      include: { actor: { select: { email: true } } },
    });
  }

  // ------------------------------------------------------------------ theme library
  @Get('themes')
  themes() {
    return this.prisma.theme.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('themes')
  async createTheme(@Body() body: ThemeDef, @CurrentUser() me: AuthUser) {
    this.checkTheme(body);
    if (await this.prisma.theme.findUnique({ where: { key: body.key } })) throw new ConflictException('Theme key exists.');
    const t = await this.prisma.theme.create({ data: { key: body.key, name: body.name, tokens: json(body.tokens) } });
    this.library.invalidate();
    await this.audit.log(me.id, 'admin.theme_create', 'Theme', t.id, { key: t.key });
    return t;
  }

  @Put('themes/:key')
  async updateTheme(@Param('key') key: string, @Body() body: ThemeDef, @CurrentUser() me: AuthUser) {
    this.checkTheme({ ...body, key });
    const t = await this.prisma.theme.update({ where: { key }, data: { name: body.name, tokens: json(body.tokens) } });
    this.library.invalidate();
    await this.audit.log(me.id, 'admin.theme_update', 'Theme', t.id, { key });
    return t;
  }

  @Delete('themes/:key')
  async deleteTheme(@Param('key') key: string, @CurrentUser() me: AuthUser) {
    const t = await this.prisma.theme.findUnique({ where: { key } });
    if (!t) throw new NotFoundException();
    if (t.builtIn) throw new BadRequestException('Built-in themes can not be deleted.');
    const inUse = await this.prisma.template.count({ where: { draft: { path: ['themes'], array_contains: [key] } } });
    if (inUse) throw new BadRequestException('Theme is used by templates.');
    await this.prisma.theme.delete({ where: { key } });
    this.library.invalidate();
    await this.audit.log(me.id, 'admin.theme_delete', 'Theme', t.id, { key });
    return { ok: true };
  }

  private checkTheme(t: ThemeDef) {
    if (!/^[a-z0-9-]{2,40}$/.test(t?.key ?? '')) throw new BadRequestException('Theme key must be lowercase letters, digits or dashes.');
    if (!t.name) throw new BadRequestException('Theme name required.');
    const tk = t.tokens;
    for (const c of ['background', 'surface', 'text', 'muted', 'primary', 'secondary', 'accent'] as const) if (!HEX.test(tk?.[c] ?? '')) throw new BadRequestException(`tokens.${c} must be a hex colour.`);
    if (!['serif', 'sans', 'display', 'mono'].includes(tk.heading)) throw new BadRequestException('tokens.heading must be serif, sans, display or mono.');
  }

  // ------------------------------------------------------------------ module library
  @Get('modules')
  modules() {
    return this.prisma.module.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  @Post('modules')
  async createModule(@Body() body: { key: string; name: string; category: string; description: string; entities: EntityDef[] }, @CurrentUser() me: AuthUser) {
    this.checkModule(body);
    if (await this.prisma.module.findUnique({ where: { key: body.key } })) throw new ConflictException('Module key exists.');
    const m = await this.prisma.module.create({ data: { key: body.key, name: body.name, category: body.category, description: body.description ?? '', entities: json(body.entities) } });
    this.library.invalidate();
    await this.audit.log(me.id, 'admin.module_create', 'Module', m.id, { key: m.key });
    return m;
  }

  @Put('modules/:key')
  async updateModule(@Param('key') key: string, @Body() body: { name: string; category: string; description: string; entities: EntityDef[]; active?: boolean }, @CurrentUser() me: AuthUser) {
    this.checkModule({ ...body, key });
    const m = await this.prisma.module.update({ where: { key }, data: { name: body.name, category: body.category, description: body.description ?? '', entities: json(body.entities), active: body.active ?? true } });
    this.library.invalidate();
    await this.audit.log(me.id, 'admin.module_update', 'Module', m.id, { key });
    return m;
  }

  private checkModule(m: { key: string; name: string; category: string; entities: EntityDef[] }) {
    if (!/^[a-z0-9-]{2,40}$/.test(m?.key ?? '')) throw new BadRequestException('Module key must be lowercase letters, digits or dashes.');
    if (!m.name) throw new BadRequestException('Module name required.');
    if (!['CRM', 'ERP', 'WEBSITE'].includes(m.category)) throw new BadRequestException('Category must be CRM, ERP or WEBSITE.');
    if (!Array.isArray(m.entities) || !m.entities.length) throw new BadRequestException('A module needs at least one entity.');
    const types = ['text', 'textarea', 'email', 'phone', 'number', 'money', 'date', 'select', 'boolean', 'relation'];
    for (const e of m.entities) {
      if (!/^[a-zA-Z][a-zA-Z0-9]{1,40}$/.test(e.key ?? '') || !e.label || !e.plural || !Array.isArray(e.fields) || !e.fields.length) throw new BadRequestException(`Entity "${e.key}" needs key, label, plural and fields.`);
      if (!e.fields.some((f) => f.key === e.displayField)) throw new BadRequestException(`Entity "${e.key}": displayField must be one of its fields.`);
      for (const f of e.fields) if (!f.key || !f.label || !types.includes(f.type)) throw new BadRequestException(`Entity "${e.key}": field "${f.key}" is invalid.`);
      if (!Array.isArray(e.listColumns)) e.listColumns = e.fields.slice(0, 5).map((f) => f.key);
    }
  }
}

@Module({ imports: [DeploymentsModule], controllers: [AdminController] })
export class AdminModule {}
