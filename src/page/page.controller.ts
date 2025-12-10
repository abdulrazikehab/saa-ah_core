import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Headers } from '@nestjs/common';
import { PageService } from './page.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
      console.log('🏢 Tenant from middleware:', req.tenantId);
      return req.tenantId;
    }
    if (req.user?.tenantId) {
      console.log('🏢 Tenant from JWT:', req.user.tenantId);
      return req.user.tenantId;
    }
    if (headerTenantId) {
      console.log('🏢 Tenant from header:', headerTenantId);
      return headerTenantId;
    }
    const defaultTenant = process.env.DEFAULT_TENANT_ID || 'default';
    console.log('🏢 Tenant from default:', defaultTenant);
    return defaultTenant;
  }

  @Post()
  create(@Request() req: any, @Body() createPageDto: any) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.create(tenantId, createPageDto);
  }

  @Public()
  @Get()
  findAll(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string
  ) {
    const tenantId = this.resolveTenantId(req, tenantIdHeader);
    console.log('📄 Finding all pages for tenant:', tenantId);
    return this.pageService.findAll(tenantId);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('slug') slug: string
  ) {
    const tenantId = this.resolveTenantId(req, tenantIdHeader);
    console.log('📄 Finding page by slug:', slug, 'for tenant:', tenantId);
    return this.pageService.findBySlug(tenantId, slug);
  }

  @Public()
  @Get(':id')
  findOne(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string
  ) {
    const tenantId = this.resolveTenantId(req, tenantIdHeader);
    console.log('📄 Finding page by id:', id, 'for tenant:', tenantId);
    return this.pageService.findOne(tenantId, id);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() updatePageDto: any) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.update(tenantId, id, updatePageDto);
  }

  @Get(':id/history')
  getHistory(@Request() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.getHistory(tenantId, id);
  }

  @Post(':id/restore/:historyId')
  restoreVersion(@Request() req: any, @Param('id') id: string, @Param('historyId') historyId: string) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.restoreVersion(tenantId, id, historyId);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    const tenantId = this.resolveTenantId(req);
    return this.pageService.remove(tenantId, id);
  }
}
