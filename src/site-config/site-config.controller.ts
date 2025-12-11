import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteConfigService } from './site-config.service';
import { Public } from '../auth/public.decorator';

/**
 * API for per‑tenant site configuration (header, background, language, payments).
 * All endpoints are tenant‑aware – the TenantMiddleware sets `req.tenantId`.
 */
@UseGuards(JwtAuthGuard) // only authenticated users can modify config
@Controller('site-config')
export class SiteConfigController {
  constructor(private readonly configService: SiteConfigService) {}

  /** Get the current configuration for the tenant */
  @Public()
  @Get()
  async getConfig(@Request() req: any, @Query('themeId') themeId?: string) {
    let tenantId = req.tenantId;

    // Fallback: If authenticated but no tenantId in token/header, check user's record
    if (!tenantId && req.user?.id) {
      const userTenantId = await this.configService.getTenantIdByUserId(req.user.id);
      if (userTenantId) {
        tenantId = userTenantId;
      }
    }

    // If still no tenantId, use default
    if (!tenantId) {
      tenantId = 'default';
    }

    return this.configService.getConfig(tenantId, themeId);
  }

  /** Update (or create) the configuration for the tenant */
  @Post()
  async upsertConfig(@Request() req: any, @Body() data: any) {
    let tenantId = req.tenantId;
    
    // Fallback to user's tenantId if not in request context
    if (!tenantId && req.user?.tenantId) {
      tenantId = req.user.tenantId;
    }

    if (!tenantId) {
      // If still no tenantId, try to find/create tenant for the user
      return this.configService.upsertConfigForUser(req.user.id, req.user.email, data);
    }

    return this.configService.upsertConfig(tenantId, data);
  }
}
