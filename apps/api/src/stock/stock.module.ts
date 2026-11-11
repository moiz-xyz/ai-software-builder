import { BadRequestException, Body, Controller, Delete, Get, Module, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser, Public, Roles } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../storage/storage.service';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 8 * 1024 * 1024;

/** Tags are lowercase slugs such as "food-desi" or "business-salon". */
export function normaliseTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  return Array.from(new Set(raw.map((t) => String(t).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')).filter((t) => t && t.length <= 40))).slice(0, 12);
}

/** Library photos the Instant Builder can choose from. Public so visitors can try the builder before signing up. */
@Controller('stock-images')
export class StockController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async list(@Query('tags') tags?: string) {
    const wanted = normaliseTags(tags ?? '');
    return this.prisma.stockImage.findMany({
      where: { active: true, ...(wanted.length ? { tags: { hasSome: wanted } } : {}) },
      select: { id: true, url: true, tags: true, title: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}

@Controller('admin/stock-images')
@Roles('ADMIN')
export class AdminStockController {
  constructor(private prisma: PrismaService, private storage: StorageService, private audit: AuditService) {}

  @Get()
  async list(@Query('tag') tag?: string) {
    const [items, all] = await Promise.all([
      this.prisma.stockImage.findMany({ where: tag ? { tags: { has: tag } } : {}, orderBy: [{ createdAt: 'desc' }] }),
      this.prisma.stockImage.findMany({ select: { tags: true, active: true } }),
    ]);
    const counts: Record<string, number> = {};
    for (const i of all) if (i.active) for (const t of i.tags) counts[t] = (counts[t] ?? 0) + 1;
    return { items, tags: Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([t, n]) => ({ tag: t, count: n })) };
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() body: { tags?: string; title?: string; creator?: string; license?: string; sourceUrl?: string }, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('No file uploaded (field name "file").');
    const ext = TYPES[file.mimetype];
    if (!ext) throw new BadRequestException('Library photos must be JPG, PNG or WEBP.');
    const tags = normaliseTags(body.tags);
    if (!tags.length) throw new BadRequestException('Add at least one tag (e.g. food-desi, restaurant-interior, business-salon).');
    const key = `stock/${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    const img = await this.prisma.stockImage.create({
      data: {
        key, url: this.storage.urlFor(key), tags, size: file.size,
        title: (body.title || file.originalname).slice(0, 200), creator: (body.creator ?? '').slice(0, 200),
        license: (body.license || 'Owned by platform').slice(0, 100), sourceUrl: (body.sourceUrl ?? '').slice(0, 500),
      },
    });
    await this.audit.log(user.id, 'stock.upload', 'StockImage', img.id, { tags });
    return img;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { tags?: string[] | string; title?: string; active?: boolean }, @CurrentUser() user: AuthUser) {
    if (!(await this.prisma.stockImage.findUnique({ where: { id } }))) throw new NotFoundException();
    const data: { tags?: string[]; title?: string; active?: boolean } = {};
    if (body.tags !== undefined) {
      data.tags = normaliseTags(body.tags);
      if (!data.tags.length) throw new BadRequestException('A library photo needs at least one tag.');
    }
    if (typeof body.title === 'string') data.title = body.title.slice(0, 200);
    if (typeof body.active === 'boolean') data.active = body.active;
    const img = await this.prisma.stockImage.update({ where: { id }, data });
    await this.audit.log(user.id, 'stock.update', 'StockImage', id, data);
    return img;
  }

  /** Safe for existing sites: projects hold their own copies of every library photo they use. */
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const img = await this.prisma.stockImage.findUnique({ where: { id } });
    if (!img) throw new NotFoundException();
    await this.prisma.stockImage.delete({ where: { id } });
    await this.storage.delete(img.key).catch(() => undefined);
    await this.audit.log(user.id, 'stock.delete', 'StockImage', id, { key: img.key });
    return { ok: true };
  }
}

@Module({ controllers: [StockController, AdminStockController] })
export class StockModule {}
