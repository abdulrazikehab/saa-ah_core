import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Headers, Query, ForbiddenException } from '@nestjs/common';
import { PageService } from './page.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';
import { RolesGuard } from '../guard/roles.guard';
import { Roles } from '../decorator/roles.decorator';
import { UserRole } from '../types/user-role.enum';
import { Public } from '../auth/public.decorator';

@Controller('pages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PageController {
  constructor(private readonly pageService: PageService) {}

  private resolveTenantId(req: any, headerTenantId?: string): string {
    // Priority: 1. Middleware (subdomain/domain), 2. JWT user, 3. Header, 4. Default
    if (req.tenantId) {
      return req.tenantId;
    }
    if (req.user?.tenantId) {
      return req.user.tenantId;
    }
    if (headerTenantId) {
      return headerTenantId;
    }
    const defaultTenant = process.env.DEFAULT_TENANT_ID || 'default';
    return defaultTenant;
  }

  @Post()
  @UseGuards(TenantRequiredGuard)
  create(@Request() req: any, @Body() createPageDto: any) {
    const tenantId = this.resolveTenantId(req);
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      throw new ForbiddenException('You must set up a market first before creating pages.');
    }
    return this.pageService.create(tenantId, createPageDto);
  }

  @Public()
  @Get()
  findAll(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string
  ) {
    const tenantId = this.resolveTenantId(req, tenantIdHeader);
    return this.pageService.findAll(tenantId);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('slug') slug: string,
    @Query('preview') preview?: string
  ) {
    const tenantId = this.resolveTenantId(req, tenantIdHeader);
    // Check if preview mode is requested (for authenticated users)
    const isPreview = preview === 'true' && req.user;
    return this.pageService.findBySlug(tenantId, slug, isPreview);
  }

  @Public()
  @Get(':id')
  findOne(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string
  ) {
    const tenantId = this.resolveTenantId(req, tenantIdHeader);
    return this.pageService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(TenantRequiredGuard)
  update(@Request() req: any, @Param('id') id: string, @Body() updatePageDto: any) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.update(tenantId, id, updatePageDto);
  }

  @Get(':id/history')
  @UseGuards(TenantRequiredGuard)
  getHistory(@Request() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.getHistory(tenantId, id);
  }

  @Post(':id/restore/:historyId')
  @UseGuards(TenantRequiredGuard)
  restoreVersion(@Request() req: any, @Param('id') id: string, @Param('historyId') historyId: string) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.restoreVersion(tenantId, id, historyId);
  }

  @Delete(':id')
  @UseGuards(TenantRequiredGuard)
  remove(@Request() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.remove(tenantId, id);
  }
}
