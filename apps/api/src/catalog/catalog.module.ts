import { Body, Controller, Get, HttpCode, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Category } from '@prisma/client';
import { featureCatalog, getModule, getTheme, Submission, TemplateDefinition, validateSubmission } from '@sf/templates';
import { Public } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { RESERVED_SLUGS, slugify } from '../common/util';
import { LibraryService } from '../library/library.service';

/** Public template catalog: only PUBLISHED templates, served at their current published version. */
@Controller('catalog')
export class CatalogController {
  constructor(private prisma: PrismaService, private library: LibraryService) {}

  private async published(category?: Category) {
    return this.prisma.template.findMany({
      where: { status: 'PUBLISHED', currentVersionId: { not: null }, ...(category ? { category } : {}) },
      include: { currentVersion: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  @Public()
  @Get('templates')
  async list(@Query('category') category?: Category) {
    const rows = await this.published(category && Object.values(Category).includes(category) ? category : undefined);
    return rows.map((t) => {
      const def = t.currentVersion!.definition as unknown as TemplateDefinition;
      return {
        id: t.id, key: t.key, name: t.name, category: t.category, description: t.description, previewImages: t.previewImages,
        version: t.currentVersion!.version,
        features: def.features, modules: def.modules, themes: def.themes, layoutVariants: def.layoutVariants,
      };
    });
  }

  @Public()
  @Get('templates/:key')
  async get(@Param('key') key: string) {
    const t = await this.prisma.template.findFirst({ where: { key, status: 'PUBLISHED' }, include: { currentVersion: true } });
    if (!t?.currentVersion) throw new NotFoundException('Template not found or not published.');
    const ctx = await this.library.context();
    const def = t.currentVersion.definition as unknown as TemplateDefinition;
    const siblings = (await this.published(t.category)).map((x) => x.currentVersion!.definition as unknown as TemplateDefinition);
    return {
      id: t.id, key: t.key, name: t.name, category: t.category, description: t.description, previewImages: t.previewImages,
      version: t.currentVersion.version,
      definition: def,
      themes: def.themes.map((k) => getTheme(k, ctx.themes)),
      modules: def.modules.map((k) => getModule(k, ctx.modules)).filter(Boolean),
      /** Features offered by other templates in this category but NOT by this one. */
      unsupportedFeatures: featureCatalog(siblings).filter((f) => !def.features.some((x) => x.key === f.key)),
    };
  }

  /** Live validation for the requirements form (rule-based, no AI). */
  @Public()
  @Post('templates/:key/validate')
  @HttpCode(200)
  async validate(@Param('key') key: string, @Body() body: Submission) {
    const t = await this.prisma.template.findFirst({ where: { key, status: 'PUBLISHED' }, include: { currentVersion: true } });
    if (!t?.currentVersion) throw new NotFoundException('Template not found or not published.');
    return validateSubmission(t.currentVersion.definition as unknown as TemplateDefinition, { values: body?.values ?? {} }, await this.library.context());
  }

  @Public()
  @Get('slug-available')
  async slugAvailable(@Query('slug') slug: string) {
    const s = slugify(slug ?? '');
    const taken = RESERVED_SLUGS.has(s) || !!(await this.prisma.project.findUnique({ where: { slug: s } }));
    return { slug: s, available: !taken };
  }
}

@Module({ controllers: [CatalogController] })
export class CatalogModule {}
