import { Global, Injectable, Module } from '@nestjs/common';
import type { EngineContext, ModuleDef, TemplateDefinition, ThemeDef } from '@sf/templates';
import { PrismaService } from '../common/prisma.service';

/**
 * Loads the admin-managed theme & module library from the DB and exposes it as an
 * EngineContext for the rule engine. Cached briefly; admin changes call invalidate().
 */
@Injectable()
export class LibraryService {
  private cache?: { at: number; ctx: Required<EngineContext> };
  constructor(private prisma: PrismaService) {}

  invalidate() {
    this.cache = undefined;
  }

  async context(): Promise<Required<EngineContext>> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.ctx;
    const [themes, modules] = await Promise.all([this.prisma.theme.findMany(), this.prisma.module.findMany({ where: { active: true } })]);
    const ctx = {
      themes: themes.map((t) => ({ key: t.key, name: t.name, tokens: t.tokens as unknown as ThemeDef['tokens'] })),
      modules: modules.map((m) => ({ key: m.key, name: m.name, category: m.category as ModuleDef['category'], description: m.description, entities: m.entities as unknown as ModuleDef['entities'] })),
    };
    this.cache = { at: Date.now(), ctx };
    return ctx;
  }

  /** Published definition a project is pinned to. */
  async definitionForVersion(templateVersionId: string): Promise<TemplateDefinition> {
    const v = await this.prisma.templateVersion.findUniqueOrThrow({ where: { id: templateVersionId } });
    return v.definition as unknown as TemplateDefinition;
  }
}

@Global()
@Module({ providers: [LibraryService], exports: [LibraryService] })
export class LibraryModule {}
