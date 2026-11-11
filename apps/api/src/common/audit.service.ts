import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(actorId: string | null | undefined, action: string, entityType: string, entityId?: string | null, meta?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { actorId: actorId ?? null, action, entityType, entityId: entityId ?? null, meta: (meta ?? undefined) as Prisma.InputJsonValue | undefined },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
