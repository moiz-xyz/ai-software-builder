import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AssetsModule } from './assets/assets.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { AccessModule } from './common/access.service';
import { AuditModule } from './common/audit.service';
import { AuthGuard, RolesGuard } from './common/guards';
import { PrismaModule } from './common/prisma.service';
import { DeploymentsModule } from './deployments/deployments.module';
import { HealthController } from './health.controller';
import { LibraryModule } from './library/library.service';
import { ProjectsModule } from './projects/projects.module';
import { SitesModule } from './sites/sites.module';
import { StockModule } from './stock/stock.module';
import { StorageModule } from './storage/storage.service';
import { TemplatesModule } from './templates/templates.module';
import { WorkspaceModule } from './workspace/workspace.module';

const redis = new URL(process.env.REDIS_URL || 'redis://localhost:6390');

@Module({
  imports: [
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET || 'dev-secret', signOptions: { expiresIn: '7d' } }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    BullModule.forRoot({ connection: { host: redis.hostname, port: Number(redis.port || 6379), password: redis.password || undefined } }),
    PrismaModule,
    AuditModule,
    AccessModule,
    LibraryModule,
    StorageModule,
    AuthModule,
    CatalogModule,
    TemplatesModule,
    AssetsModule,
    DeploymentsModule,
    ProjectsModule,
    WorkspaceModule,
    StockModule,
    SitesModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
