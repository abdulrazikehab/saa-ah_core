import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';
import { KycSettingsService } from './kyc-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycSettingsController {
  constructor(private readonly kycSettingsService: KycSettingsService) {}

  @Get('settings')
  async getSettings(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.kycSettingsService.getSettings(tenantId);
  }

  @Put('settings')
  async updateSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: {
      kycEnabled?: boolean;
      requireKycForOrders?: boolean;
      requireKycForLargePayments?: boolean;
      kycThreshold?: number;
      requireIdVerification?: boolean;
      requireAddressVerification?: boolean;
      autoApproveKyc?: boolean;
    }
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.kycSettingsService.updateSettings(tenantId, settings);
  }
}

