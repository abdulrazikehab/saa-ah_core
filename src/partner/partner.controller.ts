import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartnerService } from './partner.service';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('partner')
@UseGuards(JwtAuthGuard)
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Post('marketplace')
  async createMarketplace(
    @Request() req: AuthenticatedRequest,
    @Body() createMarketplaceDto: CreateMarketplaceDto,
  ) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    return this.partnerService.createMarketplace(tenantId, createMarketplaceDto);
  }

  @Get('status')
  async getPartnerStatus(@Request() req: AuthenticatedRequest) {
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    return this.partnerService.getPartnerStatus(tenantId);
  }
}
