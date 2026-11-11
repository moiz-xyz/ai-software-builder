import { Body, Controller, Delete, Get, Module, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import type { ProjectConfig } from '@sf/templates';
import { AuthUser, CurrentUser } from '../common/decorators';
import { DeploymentsModule } from '../deployments/deployments.module';
import { CreateProjectInput, ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private svc: ProjectsService) {}

  @Post() create(@Body() body: CreateProjectInput, @CurrentUser() u: AuthUser) { return this.svc.create(u, body); }
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.listMine(u); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.get(id, u); }

  @Put(':id/config') updateConfig(@Param('id') id: string, @Body() body: { config: ProjectConfig; message?: string; baseVersion?: number }, @CurrentUser() u: AuthUser) {
    return this.svc.updateConfig(id, u, body);
  }
  @Get(':id/versions') versions(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.versions(id, u); }
  @Get(':id/versions/:v') version(@Param('id') id: string, @Param('v', ParseIntPipe) v: number, @CurrentUser() u: AuthUser) { return this.svc.version(id, v, u); }
  @Post(':id/versions/:v/restore') restore(@Param('id') id: string, @Param('v', ParseIntPipe) v: number, @CurrentUser() u: AuthUser) { return this.svc.restore(id, v, u); }
  @Post(':id/undo') undo(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.undo(id, u); }

  @Post(':id/approve') approve(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.approve(id, u); }
  @Post(':id/unpublish') unpublish(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.unpublish(id, u); }
  @Get(':id/deployments') deployments(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.deploymentsFor(id, u); }

  @Post(':id/domains') addDomain(@Param('id') id: string, @Body('hostname') h: string, @CurrentUser() u: AuthUser) { return this.svc.addDomain(id, u, h); }
  @Post(':id/domains/:domainId/verify') verifyDomain(@Param('id') id: string, @Param('domainId') d: string, @CurrentUser() u: AuthUser) { return this.svc.verifyDomain(id, d, u); }
  @Delete(':id/domains/:domainId') removeDomain(@Param('id') id: string, @Param('domainId') d: string, @CurrentUser() u: AuthUser) { return this.svc.removeDomain(id, d, u); }

  @Get(':id/members') members(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.members(id, u); }
  @Post(':id/members') addMember(@Param('id') id: string, @Body() body: { email: string; name?: string; roleKey: string }, @CurrentUser() u: AuthUser) { return this.svc.addMember(id, u, body); }
  @Patch(':id/members/:memberId') updateMember(@Param('id') id: string, @Param('memberId') m: string, @Body('roleKey') r: string, @CurrentUser() u: AuthUser) { return this.svc.updateMember(id, m, u, r); }
  @Delete(':id/members/:memberId') removeMember(@Param('id') id: string, @Param('memberId') m: string, @CurrentUser() u: AuthUser) { return this.svc.removeMember(id, m, u); }
}

@Module({ imports: [DeploymentsModule], controllers: [ProjectsController], providers: [ProjectsService], exports: [ProjectsService] })
export class ProjectsModule {}
