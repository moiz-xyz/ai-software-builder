import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { baseConfig, TemplateDefinition, validateTemplateDefinition } from '@sf/templates';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { validationFailed } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { bumpVersion } from '../common/util';
import { LibraryService } from '../library/library.service';

class PublishDto {
  @IsIn(['major', 'minor', 'patch']) bump: 'major' | 'minor' | 'patch';
  @IsOptional() @IsString() @MaxLength(2000) changelog?: string;
}

class DuplicateDto {
  @IsString() key: string;
  @IsOptional() @IsString() name?: string;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class TemplatesService {
  constructor(private prisma: PrismaService, private audit: AuditService, private library: LibraryService) {}

  async checkDefinition(def: TemplateDefinition) {
    const r = validateTemplateDefinition(def, await this.library.context());
    if (!r.valid) throw validationFailed('Template definition is invalid.', r.errors);
  }

  list() {
    return this.prisma.template.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { currentVersion: { select: { id: true, version: true, createdAt: true } }, _count: { select: { projects: true, versions: true } } },
    });
  }

  async get(id: string) {
    const t = await this.prisma.template.findUnique({
      where: { id },
      include: { versions: { orderBy: { createdAt: 'desc' }, select: { id: true, version: true, changelog: true, createdAt: true, _count: { select: { projects: true } } } }, currentVersion: true, _count: { select: { projects: true } } },
    });
    if (!t) throw new NotFoundException('Template not found.');
    return { ...t, sampleConfig: baseConfig(t.draft as unknown as TemplateDefinition, await this.library.context()) };
  }

  async create(def: TemplateDefinition, actor: AuthUser) {
    await this.checkDefinition(def);
    if (await this.prisma.template.findUnique({ where: { key: def.key } })) throw new ConflictException(`A template with key "${def.key}" already exists.`);
    const t = await this.prisma.template.create({
      data: { key: def.key, name: def.name, category: def.category, description: def.description, previewImages: def.previewImages ?? [], draft: json(def), status: 'DRAFT' },
    });
    await this.audit.log(actor.id, 'template.create', 'Template', t.id, { key: def.key });
    return t;
  }

  /** Edits only the draft. Published versions (and projects pinned to them) are untouched. */
  async updateDraft(id: string, def: TemplateDefinition, actor: AuthUser) {
    const t = await this.prisma.template.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    if (def.key !== t.key) throw new BadRequestException('The template key can not be changed. Duplicate the template instead.');
    if (def.category !== t.category) throw new BadRequestException('The category can not be changed.');
    await this.checkDefinition(def);
    const updated = await this.prisma.template.update({
      where: { id },
      data: { name: def.name, description: def.description, previewImages: def.previewImages ?? [], draft: json(def), draftUpdatedAt: new Date() },
    });
    await this.audit.log(actor.id, 'template.update_draft', 'Template', id);
    return updated;
  }

  async duplicate(id: string, dto: DuplicateDto, actor: AuthUser) {
    const t = await this.prisma.template.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    const def = { ...(t.draft as unknown as TemplateDefinition), key: dto.key, name: dto.name || `${t.name} (copy)` };
    const copy = await this.create(def, actor);
    await this.audit.log(actor.id, 'template.duplicate', 'Template', copy.id, { from: id });
    return copy;
  }

  /** Snapshot the draft into a new immutable version and make it the catalog version. */
  async publish(id: string, dto: PublishDto, actor: AuthUser) {
    const t = await this.prisma.template.findUnique({ where: { id }, include: { currentVersion: true, versions: { select: { version: true } } } });
    if (!t) throw new NotFoundException();
    const def = t.draft as unknown as TemplateDefinition;
    await this.checkDefinition(def);
    const latest = t.versions.map((v) => v.version).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop() ?? '0.0.0';
    const version = bumpVersion(latest, dto.bump);
    const result = await this.prisma.$transaction(async (tx) => {
      const v = await tx.templateVersion.create({ data: { templateId: id, version, definition: json(def), changelog: dto.changelog } });
      return tx.template.update({ where: { id }, data: { status: 'PUBLISHED', currentVersionId: v.id }, include: { currentVersion: true } });
    });
    await this.audit.log(actor.id, 'template.publish', 'Template', id, { version });
    return result;
  }

  async setStatus(id: string, status: 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED', actor: AuthUser) {
    const t = await this.prisma.template.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    if (status === 'PUBLISHED' && !t.currentVersionId) throw new BadRequestException('Publish a version first.');
    const updated = await this.prisma.template.update({ where: { id }, data: { status } });
    await this.audit.log(actor.id, `template.${status.toLowerCase()}`, 'Template', id);
    return updated;
  }

  /** Roll the catalog back/forward to an existing version (projects keep their own pinned version). */
  async setCurrentVersion(id: string, versionId: string, actor: AuthUser) {
    const v = await this.prisma.templateVersion.findFirst({ where: { id: versionId, templateId: id } });
    if (!v) throw new NotFoundException('Version not found.');
    const updated = await this.prisma.template.update({ where: { id }, data: { currentVersionId: v.id } });
    await this.audit.log(actor.id, 'template.set_current_version', 'Template', id, { version: v.version });
    return updated;
  }

  async loadVersionIntoDraft(id: string, versionId: string, actor: AuthUser) {
    const v = await this.prisma.templateVersion.findFirst({ where: { id: versionId, templateId: id } });
    if (!v) throw new NotFoundException('Version not found.');
    await this.prisma.template.update({ where: { id }, data: { draft: json(v.definition), draftUpdatedAt: new Date() } });
    await this.audit.log(actor.id, 'template.restore_draft', 'Template', id, { version: v.version });
    return this.get(id);
  }

  async getVersion(id: string, versionId: string) {
    const v = await this.prisma.templateVersion.findFirst({ where: { id: versionId, templateId: id } });
    if (!v) throw new NotFoundException();
    return v;
  }

  async remove(id: string, actor: AuthUser) {
    const t = await this.prisma.template.findUnique({ where: { id }, include: { _count: { select: { projects: true } } } });
    if (!t) throw new NotFoundException();
    if (t._count.projects > 0) throw new ConflictException('Templates used by customer projects can only be archived, not deleted.');
    await this.prisma.template.update({ where: { id }, data: { currentVersionId: null } });
    await this.prisma.template.delete({ where: { id } });
    await this.audit.log(actor.id, 'template.delete', 'Template', id, { key: t.key });
    return { ok: true };
  }
}

@Controller('admin/templates')
@Roles('ADMIN')
export class TemplatesController {
  constructor(private svc: TemplatesService) {}

  @Get() list() { return this.svc.list(); }
  @Post() create(@Body() def: TemplateDefinition, @CurrentUser() u: AuthUser) { return this.svc.create(def, u); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Put(':id') update(@Param('id') id: string, @Body() def: TemplateDefinition, @CurrentUser() u: AuthUser) { return this.svc.updateDraft(id, def, u); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.remove(id, u); }
  @Post(':id/duplicate') duplicate(@Param('id') id: string, @Body() dto: DuplicateDto, @CurrentUser() u: AuthUser) { return this.svc.duplicate(id, dto, u); }
  @Post(':id/publish') publish(@Param('id') id: string, @Body() dto: PublishDto, @CurrentUser() u: AuthUser) { return this.svc.publish(id, dto, u); }
  @Post(':id/unpublish') unpublish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.setStatus(id, 'UNPUBLISHED', u); }
  @Post(':id/republish') republish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.setStatus(id, 'PUBLISHED', u); }
  @Post(':id/archive') archive(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.setStatus(id, 'ARCHIVED', u); }
  @Get(':id/versions/:versionId') version(@Param('id') id: string, @Param('versionId') v: string) { return this.svc.getVersion(id, v); }
  @Post(':id/versions/:versionId/make-current') makeCurrent(@Param('id') id: string, @Param('versionId') v: string, @CurrentUser() u: AuthUser) { return this.svc.setCurrentVersion(id, v, u); }
  @Post(':id/versions/:versionId/load-draft') loadDraft(@Param('id') id: string, @Param('versionId') v: string, @CurrentUser() u: AuthUser) { return this.svc.loadVersionIntoDraft(id, v, u); }
}

@Module({ controllers: [TemplatesController], providers: [TemplatesService], exports: [TemplatesService] })
export class TemplatesModule {}
