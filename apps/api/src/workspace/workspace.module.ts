import { Body, Controller, DefaultValuePipe, Delete, Get, Module, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators';
import { WorkspaceService } from './workspace.service';

/** CRM / ERP workspace API. Every route is scoped by :projectId and checked by AccessService. */
@Controller('projects/:projectId/workspace')
export class WorkspaceController {
  constructor(private svc: WorkspaceService) {}

  @Get('meta') meta(@Param('projectId') p: string, @CurrentUser() u: AuthUser) { return this.svc.meta(p, u); }
  @Get('dashboard') dashboard(@Param('projectId') p: string, @CurrentUser() u: AuthUser) { return this.svc.dashboard(p, u); }

  @Get('records/:entity')
  list(@Param('projectId') p: string, @Param('entity') e: string, @Query('q') q: string | undefined, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @CurrentUser() u: AuthUser) {
    return this.svc.list(p, u, e, q, Math.max(1, page));
  }
  @Get('options/:entity') options(@Param('projectId') p: string, @Param('entity') e: string, @CurrentUser() u: AuthUser) { return this.svc.options(p, u, e); }
  @Get('records/:entity/:id') get(@Param('projectId') p: string, @Param('entity') e: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.get(p, u, e, id); }
  @Post('records/:entity') create(@Param('projectId') p: string, @Param('entity') e: string, @Body() body: Record<string, unknown>, @CurrentUser() u: AuthUser) { return this.svc.create(p, u, e, body); }
  @Patch('records/:entity/:id') update(@Param('projectId') p: string, @Param('entity') e: string, @Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() u: AuthUser) { return this.svc.update(p, u, e, id, body); }
  @Delete('records/:entity/:id') remove(@Param('projectId') p: string, @Param('entity') e: string, @Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.remove(p, u, e, id); }
  @Post('leads/:id/convert') convert(@Param('projectId') p: string, @Param('id') id: string, @Body('createDeal') createDeal: boolean, @CurrentUser() u: AuthUser) { return this.svc.convertLead(p, u, id, createDeal !== false); }
}

@Module({ controllers: [WorkspaceController], providers: [WorkspaceService], exports: [WorkspaceService] })
export class WorkspaceModule {}
