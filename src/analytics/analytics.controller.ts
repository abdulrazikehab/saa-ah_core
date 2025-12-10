import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('orders')
  async orderStats(@Request() req: any) {
    return this.analyticsService.getOrderStats(req.user.tenantId);
  }

  @Get('traffic')
  async trafficStats(@Request() req: any) {
    return this.analyticsService.getTrafficStats(req.user.tenantId);
  }
}
