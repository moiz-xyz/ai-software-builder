import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Project } from '@prisma/client';
import { getTheme, TemplateDefinition } from '@sf/templates';
import { AuditService } from '../common/audit.service';
import { Public } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { LibraryService } from '../library/library.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspaceService } from '../workspace/workspace.service';

/**
 * Public rendering data. The web app renders the customer's site with the code-implemented
 * template renderer + this project's config — no per-customer code is generated.
 */
@Controller()
export class SitesController {
  constructor(private prisma: PrismaService, private library: LibraryService, private workspace: WorkspaceService, private audit: AuditService) {}

  private async payload(project: Project, config: unknown, mode: 'preview' | 'live') {
    const def = await this.library.definitionForVersion(project.templateVersionId);
    const ctx = await this.library.context();
    const cfg = config as { branding: { theme: string } };
    return {
      mode,
      project: { id: project.id, name: project.name, slug: project.slug, category: project.category, status: project.status },
      template: { key: def.key, renderer: def.renderer, name: def.name, sections: def.sections.map((s) => ({ key: s.key, label: s.label })) } as Partial<TemplateDefinition>,
      theme: getTheme(cfg.branding.theme, ctx.themes),
      config,
    };
  }

  @Public()
  @Get('public/preview/:token')
  async preview(@Param('token') token: string) {
    const project = await this.prisma.project.findUnique({ where: { previewToken: token } });
    if (!project) throw new NotFoundException('Preview not found.');
    return this.payload(project, project.config, 'preview');
  }

  @Public()
  @Get('public/sites/resolve')
  async resolve(@Query('host') host?: string, @Query('slug') slug?: string) {
    let project: Project | null = null;
    if (slug) project = await this.prisma.project.findUnique({ where: { slug } });
    else if (host) {
      const hostname = host.toLowerCase().split(':')[0];
      const domain = await this.prisma.domain.findUnique({ where: { hostname }, include: { project: true } });
      if (domain && (domain.type === 'SUBDOMAIN' || domain.verified)) project = domain.project;
    }
    if (!project || project.status !== 'PUBLISHED' || !project.publishedConfig) throw new NotFoundException('Site not found.');
    return this.payload(project, project.publishedConfig, 'live');
  }

  /** Contact / reservation forms on published sites (and on previews, via preview token). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/sites/:projectId/forms/:kind')
  @HttpCode(201)
  async submit(@Param('projectId') projectId: string, @Param('kind') kind: string, @Body() body: Record<string, unknown>, @Query('preview') previewToken?: string) {
    if (kind !== 'inquiry' && kind !== 'reservation') throw new NotFoundException();
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const allowed = project.status === 'PUBLISHED' || (previewToken && previewToken === project.previewToken);
    if (!allowed) throw new ForbiddenException('This site is not published.');
    return this.workspace.createFromWebsite(project, kind, body);
  }

  /** For on-demand TLS / cert scripts: is this hostname allowed to get a certificate? */
  @Public()
  @Get('internal/domains/allowed')
  async allowed(@Query('domain') domain: string) {
    const d = await this.prisma.domain.findUnique({ where: { hostname: String(domain || '').toLowerCase() }, include: { project: { select: { status: true } } } });
    if (!d || (d.type === 'CUSTOM' && !d.verified)) throw new NotFoundException();
    return { ok: true };
  }

  /** Called by infra/scripts/issue-certs.sh after certbot runs. */
  @Public()
  @Post('internal/domains/ssl')
  async ssl(@Headers('x-internal-token') tokenHeader: string, @Body() body: { hostname: string; status: 'ACTIVE' | 'FAILED' }) {
    if (!process.env.INTERNAL_TOKEN || tokenHeader !== process.env.INTERNAL_TOKEN) throw new ForbiddenException();
    const d = await this.prisma.domain.update({ where: { hostname: body.hostname }, data: { sslStatus: body.status === 'ACTIVE' ? 'ACTIVE' : 'FAILED' } });
    await this.audit.log(null, 'domain.ssl', 'Project', d.projectId, { hostname: d.hostname, status: d.sslStatus });
    return d;
  }

  @Public()
  @Get('internal/domains/pending-ssl')
  async pendingSsl(@Headers('x-internal-token') tokenHeader: string) {
    if (!process.env.INTERNAL_TOKEN || tokenHeader !== process.env.INTERNAL_TOKEN) throw new ForbiddenException();
    return this.prisma.domain.findMany({ where: { type: 'CUSTOM', verified: true, sslStatus: { not: 'ACTIVE' } }, select: { hostname: true } });
  }
}

@Module({ imports: [WorkspaceModule], controllers: [SitesController] })
export class SitesModule {}
