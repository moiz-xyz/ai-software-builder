import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Project } from '@prisma/client';
import { EntityDef, entitiesForModules, getPath, ProjectConfig, TemplateDefinition } from '@sf/templates';
import { AccessService, hasPermission, ProjectAccess } from '../common/access.service';
import { AuditService } from '../common/audit.service';
import type { AuthUser } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { LibraryService } from '../library/library.service';

type Entity = EntityDef & { module: string };
type Data = Record<string, unknown>;
type Tx = Prisma.TransactionClient;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const json = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService, private access: AccessService, private library: LibraryService, private audit: AuditService) {}

  /** Config the workspace runs on: owners see their latest edits, members see the published one. */
  private configFor(project: Project, acc?: ProjectAccess): ProjectConfig {
    const useDraft = !project.publishedConfig || acc?.isOwner || acc?.isPlatformAdmin;
    return (useDraft ? project.config : project.publishedConfig) as unknown as ProjectConfig;
  }

  async entitiesFor(project: Project, config: ProjectConfig): Promise<Entity[]> {
    const ctx = await this.library.context();
    if (project.category === 'WEBSITE') {
      const def = await this.library.definitionForVersion(project.templateVersionId);
      const mods = def.modules.filter((m) => (m === 'reservations' ? config.features.includes('reservations') : m === 'inquiries' ? config.features.includes('contactForm') : true));
      return entitiesForModules(mods, ctx.modules);
    }
    return entitiesForModules(config.modules, ctx.modules);
  }

  private resolveOptions(entity: Entity, config: ProjectConfig): Entity {
    return {
      ...entity,
      fields: entity.fields.map((f) => {
        if (!f.optionsFrom) return f;
        const fromConfig = getPath(config, f.optionsFrom);
        return Array.isArray(fromConfig) && fromConfig.length ? { ...f, options: (fromConfig as unknown[]).map(String) } : f;
      }),
    };
  }

  private async load(projectId: string, user: AuthUser, entityKey: string, action: 'read' | 'write') {
    const acc = await this.access.resolve(projectId, user);
    const config = this.configFor(acc.project, acc);
    const entities = await this.entitiesFor(acc.project, config);
    const entity = entities.find((e) => e.key === entityKey);
    if (!entity) throw new NotFoundException(`"${entityKey}" is not enabled in this project.`);
    if (!hasPermission(acc.permissions, entity.module, action)) throw new ForbiddenException(`Your role does not allow ${action} access to ${entity.plural}.`);
    return { acc, config, entity: this.resolveOptions(entity, config), entities };
  }

  // ------------------------------------------------------------------ meta

  async meta(projectId: string, user: AuthUser) {
    const acc = await this.access.resolve(projectId, user);
    const config = this.configFor(acc.project, acc);
    const entities = (await this.entitiesFor(acc.project, config)).map((e) => this.resolveOptions(e, config));
    const def = await this.library.definitionForVersion(acc.project.templateVersionId);
    return {
      project: { id: acc.project.id, name: acc.project.name, category: acc.project.category, status: acc.project.status, slug: acc.project.slug },
      preview: acc.project.status !== 'PUBLISHED',
      config: { business: config.business, branding: config.branding, content: config.content, features: config.features, modules: config.modules },
      modules: (await this.library.context()).modules.filter((m) => config.modules.includes(m.key) || (acc.project.category === 'WEBSITE' && def.modules.includes(m.key))).map((m) => ({ key: m.key, name: m.name })),
      entities: entities.map((e) => ({ ...e, canRead: hasPermission(acc.permissions, e.module, 'read'), canWrite: hasPermission(acc.permissions, e.module, 'write') })),
      permissions: acc.permissions,
      role: acc.roleKey,
      isOwner: acc.isOwner || acc.isPlatformAdmin,
      canManageUsers: hasPermission(acc.permissions, 'users', 'manage'),
    };
  }

  // ------------------------------------------------------------------ validation

  /** Coerce + validate a record against the entity definition. Relations must exist in the SAME project. */
  async clean(tx: Tx | PrismaService, projectId: string, entity: Entity, input: Data, existing?: Data): Promise<Data> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Record data must be an object.');
    const out: Data = { ...(existing ?? {}) };
    const errors: string[] = [];
    for (const f of entity.fields) {
      let v = f.key in input ? input[f.key] : existing ? existing[f.key] : f.default;
      if (v === '' || v === undefined) v = null;
      if (v !== null) {
        switch (f.type) {
          case 'number':
          case 'money': {
            const n = typeof v === 'number' ? v : Number(v);
            if (!Number.isFinite(n)) errors.push(`${f.label} must be a number.`);
            else v = f.type === 'money' ? Math.round(n * 100) / 100 : n;
            break;
          }
          case 'boolean':
            v = v === true || v === 'true' || v === 1;
            break;
          case 'email':
            if (!EMAIL.test(String(v))) errors.push(`${f.label} must be a valid email.`);
            v = String(v).trim();
            break;
          case 'date':
            if (!DATE.test(String(v))) errors.push(`${f.label} must be a date (YYYY-MM-DD).`);
            break;
          case 'select':
            if (f.options && !f.options.includes(String(v))) errors.push(`${f.label} must be one of: ${f.options.join(', ')}.`);
            break;
          case 'relation': {
            const rel = await tx.workspaceRecord.findFirst({ where: { id: String(v), projectId, entity: f.relation } });
            if (!rel) errors.push(`${f.label}: selected record not found.`);
            break;
          }
          default:
            v = String(v).slice(0, f.type === 'textarea' ? 5000 : 500);
        }
      }
      if (f.required && (v === null || v === '')) errors.push(`${f.label} is required.`);
      out[f.key] = v;
    }
    // Drop unknown keys from input entirely (they never reach the DB).
    for (const k of Object.keys(out)) if (!entity.fields.some((f) => f.key === k)) delete out[k];
    if (errors.length) throw new BadRequestException({ statusCode: 400, message: errors.join(' '), errors });
    return out;
  }

  // ------------------------------------------------------------------ business rules

  private async adjustStock(tx: Tx, projectId: string, productId: string, delta: number) {
    const p = await tx.workspaceRecord.findFirst({ where: { id: productId, projectId, entity: 'product' } });
    if (!p) throw new BadRequestException('Product not found.');
    const data = p.data as Data;
    const qty = Number(data.quantity ?? 0) + delta;
    if (qty < 0) throw new BadRequestException(`Not enough stock for ${data.name}: ${data.quantity} available.`);
    await tx.workspaceRecord.update({ where: { id: p.id }, data: { data: json({ ...data, quantity: qty }) } });
  }

  private async addMovement(tx: Tx, projectId: string, userId: string, product: string, type: 'IN' | 'OUT', quantity: number, reference: string) {
    await tx.workspaceRecord.create({
      data: { projectId, module: 'inventory', entity: 'stockMovement', createdById: userId, data: json({ product, type, quantity, reference, date: new Date().toISOString().slice(0, 10) }) },
    });
    await this.adjustStock(tx, projectId, product, type === 'IN' ? quantity : -quantity);
  }

  private async applyRules(tx: Tx, projectId: string, userId: string, config: ProjectConfig, entity: string, data: Data, before?: Data) {
    const has = (f: string) => config.features.includes(f);
    const mod = (m: string) => config.modules.includes(m);

    if (entity === 'salesOrder' || entity === 'purchaseOrder') {
      const unit = Number(entity === 'salesOrder' ? data.unitPrice : data.unitCost) || 0;
      if (unit > 0) data.total = Math.round(unit * Number(data.quantity || 0) * 100) / 100;
    }
    if (entity === 'stockMovement' && !before) {
      const q = Number(data.quantity);
      if (!(q > 0) && data.type !== 'ADJUST') throw new BadRequestException('Quantity must be positive.');
      await this.adjustStock(tx, projectId, String(data.product), data.type === 'OUT' ? -q : q);
    }
    if (entity === 'salesOrder' && data.status === 'Fulfilled' && before?.status !== 'Fulfilled') {
      if (has('autoStockOnSale') && mod('inventory')) await this.addMovement(tx, projectId, userId, String(data.product), 'OUT', Number(data.quantity), `SO ${data.number}`);
      if (has('autoInvoice') && mod('accounting')) {
        await tx.workspaceRecord.create({
          data: { projectId, module: 'accounting', entity: 'invoice', createdById: userId, data: json({ number: `INV-${data.number}`, customer: data.customer, amount: data.total ?? 0, status: 'Sent', dueDate: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) }) },
        });
      }
    }
    if (entity === 'salesOrder' && before?.status === 'Fulfilled' && data.status !== 'Fulfilled') throw new BadRequestException('Fulfilled orders can not be re-opened. Create a stock adjustment instead.');
    if (entity === 'purchaseOrder' && data.status === 'Received' && before?.status !== 'Received') {
      if (has('autoStockOnPurchase') && mod('inventory')) await this.addMovement(tx, projectId, userId, String(data.product), 'IN', Number(data.quantity), `PO ${data.number}`);
    }
    if (entity === 'purchaseOrder' && before?.status === 'Received' && data.status !== 'Received') throw new BadRequestException('Received purchase orders can not be re-opened.');
  }

  // ------------------------------------------------------------------ CRUD

  async list(projectId: string, user: AuthUser, entityKey: string, q?: string, page = 1) {
    const { entity } = await this.load(projectId, user, entityKey, 'read');
    const rows = await this.prisma.workspaceRecord.findMany({ where: { projectId, entity: entity.key }, orderBy: { createdAt: 'desc' }, take: 5000 });
    const needle = q?.toLowerCase().trim();
    const filtered = needle ? rows.filter((r) => JSON.stringify(r.data).toLowerCase().includes(needle)) : rows;
    const size = 50;
    const slice = filtered.slice((page - 1) * size, page * size);
    return { total: filtered.length, page, pageSize: size, items: slice, labels: await this.relationLabels(projectId, entity, slice.map((r) => r.data as Data)) };
  }

  /** id → display label for every relation value in the given rows (same project only). */
  async relationLabels(projectId: string, entity: Entity, rows: Data[]) {
    const ids = new Set<string>();
    for (const f of entity.fields.filter((x) => x.type === 'relation')) for (const r of rows) if (r[f.key]) ids.add(String(r[f.key]));
    if (!ids.size) return {};
    const related = await this.prisma.workspaceRecord.findMany({ where: { projectId, id: { in: [...ids] } } });
    const ctx = await this.library.context();
    const allEntities = entitiesForModules(ctx.modules.map((m) => m.key), ctx.modules);
    return Object.fromEntries(related.map((r) => {
      const def = allEntities.find((e) => e.key === r.entity);
      return [r.id, String((r.data as Data)[def?.displayField ?? 'name'] ?? r.id)];
    }));
  }

  /** Options for relation pickers. */
  async options(projectId: string, user: AuthUser, entityKey: string) {
    const { entity } = await this.load(projectId, user, entityKey, 'read');
    const rows = await this.prisma.workspaceRecord.findMany({ where: { projectId, entity: entity.key }, orderBy: { createdAt: 'desc' }, take: 1000 });
    return rows.map((r) => ({ value: r.id, label: String((r.data as Data)[entity.displayField] ?? r.id) }));
  }

  async get(projectId: string, user: AuthUser, entityKey: string, id: string) {
    const { entity } = await this.load(projectId, user, entityKey, 'read');
    const r = await this.prisma.workspaceRecord.findFirst({ where: { id, projectId, entity: entity.key } });
    if (!r) throw new NotFoundException('Record not found.');
    return r;
  }

  async create(projectId: string, user: AuthUser, entityKey: string, input: Data) {
    const { config, entity } = await this.load(projectId, user, entityKey, 'write');
    const rec = await this.prisma.$transaction(async (tx) => {
      const data = await this.clean(tx, projectId, entity, input);
      await this.applyRules(tx, projectId, user.id, config, entity.key, data);
      return tx.workspaceRecord.create({ data: { projectId, module: entity.module, entity: entity.key, data: json(data), createdById: user.id } });
    });
    await this.audit.log(user.id, 'record.create', 'Project', projectId, { entity: entity.key, recordId: rec.id });
    return rec;
  }

  async update(projectId: string, user: AuthUser, entityKey: string, id: string, input: Data) {
    const { config, entity } = await this.load(projectId, user, entityKey, 'write');
    if (entity.key === 'stockMovement') throw new BadRequestException('Stock movements are immutable. Record a new adjustment instead.');
    const rec = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.workspaceRecord.findFirst({ where: { id, projectId, entity: entity.key } });
      if (!existing) throw new NotFoundException('Record not found.');
      const before = existing.data as Data;
      const data = await this.clean(tx, projectId, entity, input, before);
      await this.applyRules(tx, projectId, user.id, config, entity.key, data, before);
      return tx.workspaceRecord.update({ where: { id }, data: { data: json(data) } });
    });
    await this.audit.log(user.id, 'record.update', 'Project', projectId, { entity: entity.key, recordId: id });
    return rec;
  }

  async remove(projectId: string, user: AuthUser, entityKey: string, id: string) {
    const { entity } = await this.load(projectId, user, entityKey, 'write');
    if (entity.key === 'stockMovement') throw new BadRequestException('Stock movements can not be deleted. Record a new adjustment instead.');
    const existing = await this.prisma.workspaceRecord.findFirst({ where: { id, projectId, entity: entity.key } });
    if (!existing) throw new NotFoundException('Record not found.');
    const referenced = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "WorkspaceRecord" WHERE "projectId" = ${projectId} AND id <> ${id} AND data::text LIKE ${'%"' + id + '"%'}`;
    if (Number(referenced[0]?.n ?? 0) > 0) throw new BadRequestException('This record is used by other records and can not be deleted.');
    await this.prisma.workspaceRecord.delete({ where: { id } });
    await this.audit.log(user.id, 'record.delete', 'Project', projectId, { entity: entity.key, recordId: id });
    return { ok: true };
  }

  async convertLead(projectId: string, user: AuthUser, id: string, createDeal: boolean) {
    const { config } = await this.load(projectId, user, 'lead', 'write');
    if (!config.features.includes('leadConversion')) throw new BadRequestException('Lead conversion is not enabled for this project.');
    if (!config.modules.includes('contacts')) throw new BadRequestException('Enable the Contacts module to convert leads.');
    const acc = await this.access.require(projectId, user, 'contacts', 'write');
    const result = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.workspaceRecord.findFirst({ where: { id, projectId, entity: 'lead' } });
      if (!lead) throw new NotFoundException('Lead not found.');
      const d = lead.data as Data;
      if (d.status === 'Converted') throw new BadRequestException('Lead already converted.');
      const contact = await tx.workspaceRecord.create({ data: { projectId, module: 'contacts', entity: 'contact', createdById: user.id, data: json({ name: d.name, email: d.email ?? null, phone: d.phone ?? null, status: 'Active', notes: d.notes ?? null }) } });
      let deal = null;
      if (createDeal && config.modules.includes('deals') && hasPermission(acc.permissions, 'deals', 'write')) {
        const stages = (getPath(config, 'content.pipelineStages') as string[]) ?? ['New'];
        deal = await tx.workspaceRecord.create({ data: { projectId, module: 'deals', entity: 'deal', createdById: user.id, data: json({ title: `${d.name} — opportunity`, contact: contact.id, value: 0, stage: stages[0] ?? 'New' }) } });
      }
      await tx.workspaceRecord.update({ where: { id }, data: { data: json({ ...d, status: 'Converted' }) } });
      return { contact, deal };
    });
    await this.audit.log(user.id, 'lead.convert', 'Project', projectId, { leadId: id });
    return result;
  }

  // ------------------------------------------------------------------ dashboard

  async dashboard(projectId: string, user: AuthUser) {
    const acc = await this.access.resolve(projectId, user);
    const config = this.configFor(acc.project, acc);
    const entities = (await this.entitiesFor(acc.project, config)).filter((e) => hasPermission(acc.permissions, e.module, 'read'));
    const keys = entities.map((e) => e.key);
    const rows = await this.prisma.workspaceRecord.findMany({ where: { projectId, entity: { in: keys } }, select: { entity: true, data: true, createdAt: true } });
    const by = (k: string) => rows.filter((r) => r.entity === k).map((r) => r.data as Data);
    const sum = (arr: Data[], f: string) => Math.round(arr.reduce((a, r) => a + (Number(r[f]) || 0), 0) * 100) / 100;
    const groupBy = (arr: Data[], f: string, valueField?: string) => {
      const out: Record<string, number> = {};
      for (const r of arr) out[String(r[f] ?? '—')] = (out[String(r[f] ?? '—')] ?? 0) + (valueField ? Number(r[valueField]) || 0 : 1);
      return out;
    };
    const widgets: Record<string, unknown> = { counts: Object.fromEntries(entities.map((e) => [e.plural, by(e.key).length])) };
    if (keys.includes('deal')) {
      const deals = by('deal');
      widgets.pipeline = { countByStage: groupBy(deals, 'stage'), valueByStage: groupBy(deals, 'stage', 'value'), wonValue: sum(deals.filter((d) => d.stage === 'Won'), 'value'), openValue: sum(deals.filter((d) => !['Won', 'Lost'].includes(String(d.stage))), 'value') };
    }
    if (keys.includes('lead')) widgets.leads = { byStatus: groupBy(by('lead'), 'status'), bySource: groupBy(by('lead'), 'source') };
    if (keys.includes('task')) widgets.tasks = { open: by('task').filter((t) => !t.done).length, overdue: by('task').filter((t) => !t.done && t.dueDate && String(t.dueDate) < new Date().toISOString().slice(0, 10)).length };
    if (keys.includes('product')) {
      const products = by('product');
      widgets.inventory = {
        stockValue: Math.round(products.reduce((a, p) => a + (Number(p.cost) || 0) * (Number(p.quantity) || 0), 0) * 100) / 100,
        lowStock: config.features.includes('lowStockAlerts') ? products.filter((p) => Number(p.quantity) <= Number(p.reorderLevel ?? 0)).map((p) => ({ sku: p.sku, name: p.name, quantity: p.quantity, reorderLevel: p.reorderLevel })) : [],
      };
    }
    if (keys.includes('salesOrder')) widgets.sales = { fulfilledTotal: sum(by('salesOrder').filter((s) => s.status === 'Fulfilled'), 'total'), byStatus: groupBy(by('salesOrder'), 'status') };
    if (keys.includes('purchaseOrder')) widgets.purchases = { receivedTotal: sum(by('purchaseOrder').filter((s) => s.status === 'Received'), 'total'), byStatus: groupBy(by('purchaseOrder'), 'status') };
    if (keys.includes('invoice')) widgets.accounting = { outstanding: sum(by('invoice').filter((i) => i.status !== 'Paid'), 'amount'), paid: sum(by('invoice').filter((i) => i.status === 'Paid'), 'amount'), expenses: keys.includes('expense') ? sum(by('expense'), 'amount') : 0 };
    if (keys.includes('employee')) widgets.hr = { active: by('employee').filter((e) => e.status === 'Active').length, payroll: sum(by('employee').filter((e) => e.status === 'Active'), 'salary'), byDepartment: groupBy(by('employee'), 'department') };
    if (keys.includes('reservation')) widgets.reservations = { upcoming: by('reservation').filter((r) => String(r.date) >= new Date().toISOString().slice(0, 10) && r.status !== 'Cancelled').length };
    if (keys.includes('inquiry')) widgets.inquiries = { total: by('inquiry').length };
    widgets.currency = (getPath(config, 'content.currency') as string) || 'USD';
    return widgets;
  }

  // ------------------------------------------------------------------ public website forms

  /** Used by published sites: visitors submit inquiries / reservations into the owner's workspace. */
  async createFromWebsite(project: Project, entityKey: 'inquiry' | 'reservation', input: Data) {
    const config = (project.publishedConfig ?? project.config) as unknown as ProjectConfig;
    const entities = await this.entitiesFor(project, config);
    const entity = entities.find((e) => e.key === entityKey);
    if (!entity) throw new BadRequestException('This form is not enabled on this website.');
    const allowed = entityKey === 'reservation' ? ['name', 'phone', 'email', 'date', 'time', 'guests'] : ['name', 'email', 'phone', 'message'];
    const filtered = Object.fromEntries(Object.entries(input ?? {}).filter(([k]) => allowed.includes(k)));
    if (entityKey === 'reservation') {
      const max = Number(getPath(config, 'content.reservation.maxGuests') ?? 20);
      if (Number(filtered.guests) > max) throw new BadRequestException(`Online bookings are limited to ${max} guests. Please call us for larger groups.`);
      if (String(filtered.date ?? '') < new Date().toISOString().slice(0, 10)) throw new BadRequestException('Please choose a future date.');
    }
    const data = await this.clean(this.prisma, project.id, entity, filtered);
    if (entityKey === 'reservation') data.status = 'Pending';
    const rec = await this.prisma.workspaceRecord.create({ data: { projectId: project.id, module: entity.module, entity: entity.key, data: json(data) } });
    await this.audit.log(null, `website.${entityKey}`, 'Project', project.id, { recordId: rec.id });
    return { ok: true };
  }
}

export type { TemplateDefinition };
