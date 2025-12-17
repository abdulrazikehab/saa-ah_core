import { Controller, Get, Post, Body, UseGuards, Request, Query, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';
import { SiteConfigService } from './site-config.service';
import { Public } from '../auth/public.decorator';
import { AuthenticatedRequest } from '../types/request.types';

/**
 * API for per‑tenant site configuration (header, background, language, payments).
 * All endpoints are tenant‑aware – the TenantMiddleware sets `req.tenantId`.
 */
@UseGuards(JwtAuthGuard) // only authenticated users can modify config
@Controller('site-config')
export class SiteConfigController {
  private readonly logger = new Logger(SiteConfigController.name);

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
  @UseGuards(TenantRequiredGuard)
  async upsertConfig(@Request() req: AuthenticatedRequest, @Body() data: any) {
    try {
      // TenantRequiredGuard should have already validated tenantId
      const tenantId = req.user?.tenantId || req.tenantId;
      
      if (!tenantId || tenantId === 'default' || tenantId === 'system') {
        this.logger.error('Site config update failed: Invalid tenantId', {
          tenantId,
          hasUserTenantId: !!req.user?.tenantId,
          hasReqTenantId: !!req.tenantId,
        });
        throw new ForbiddenException(
          'You must set up a market first before updating site configuration. Please go to Market Setup to create your store.'
        );
      }

      this.logger.log(`Updating site config for tenant: ${tenantId}`);
      return await this.configService.upsertConfig(tenantId, data);
    } catch (error: any) {
      this.logger.error('Error updating site config:', error);
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update site configuration: ${error?.message || 'Unknown error'}`);
    }
  }
}
