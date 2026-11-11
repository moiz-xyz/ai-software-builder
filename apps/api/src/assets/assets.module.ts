import { BadRequestException, Controller, Delete, ForbiddenException, Get, Module, NotFoundException, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { AccessService } from '../common/access.service';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};
const MAX_BYTES = 8 * 1024 * 1024;

@Controller()
export class AssetsController {
  constructor(private prisma: PrismaService, private storage: StorageService, private access: AccessService, private audit: AuditService) {}

  /**
   * Upload an image/logo.
   * - With ?projectId: stored under projects/<id>/ (owner only).
   * - Without: staged under staging/<userId>/ for the requirements wizard; copied into the
   *   project when it is created, so projects never share files.
   */
  @Post('assets')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Query('projectId') projectId: string | undefined, @Query('kind') kind: string | undefined, @Query('templateId') templateId: string | undefined, @CurrentUser() user: AuthUser) {
    if (!file) throw new BadRequestException('No file uploaded (field name "file").');
    const ext = ALLOWED[file.mimetype];
    if (!ext) throw new BadRequestException('Only PNG, JPG, WEBP, GIF, SVG and PDF files are allowed.');
    if (projectId) await this.access.owner(projectId, user);
    if (templateId) {
      if (user.role !== 'ADMIN') throw new ForbiddenException('Only administrators can upload template assets.');
      if (!(await this.prisma.template.findUnique({ where: { id: templateId } }))) throw new NotFoundException('Template not found.');
    }
    const prefix = projectId ? `projects/${projectId}` : templateId ? `templates/${templateId}` : `staging/${user.id}`;
    const key = `${prefix}/${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    const asset = await this.prisma.asset.create({
      data: {
        ownerId: user.id,
        projectId: projectId ?? null,
        templateId: templateId ?? null,
        kind: kind === 'logo' ? 'logo' : file.mimetype === 'application/pdf' ? 'document' : 'image',
        key,
        url: this.storage.urlFor(key),
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname.slice(0, 200),
      },
    });
    if (projectId) await this.audit.log(user.id, 'asset.upload', 'Project', projectId, { assetId: asset.id, name: asset.originalName });
    return { ...asset, ref: `asset:${asset.id}` };
  }

  @Get('projects/:projectId/assets')
  async list(@Param('projectId') projectId: string, @CurrentUser() user: AuthUser) {
    await this.access.resolve(projectId, user);
    return this.prisma.asset.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  }

  @Delete('assets/:id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    if (asset.projectId) await this.access.owner(asset.projectId, user);
    else if (asset.ownerId !== user.id && user.role !== 'ADMIN') throw new NotFoundException();
    await this.storage.delete(asset.key).catch(() => undefined);
    await this.prisma.asset.delete({ where: { id } });
    if (asset.projectId) await this.audit.log(user.id, 'asset.delete', 'Project', asset.projectId, { assetId: id });
    return { ok: true };
  }

  /** Public file serving (keys are random UUIDs). Published sites load images from here. */
  @Public()
  @Get('files/*')
  async file(@Req() req: Request, @Res() res: Response) {
    const key = decodeURIComponent(req.path.replace(/^\/files\//, ''));
    if (!/^(projects|staging|templates|stock)\/[A-Za-z0-9_\-/]+\.[a-z]{3,4}$/.test(key) || key.includes('..')) throw new NotFoundException();
    try {
      const obj = await this.storage.get(key);
      res.setHeader('Content-Type', obj.contentType || 'application/octet-stream');
      if (obj.length) res.setHeader('Content-Length', String(obj.length));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (obj.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      obj.body.pipe(res);
    } catch {
      res.status(404).json({ statusCode: 404, message: 'File not found' });
    }
  }
}

@Module({ controllers: [AssetsController] })
export class AssetsModule {}
