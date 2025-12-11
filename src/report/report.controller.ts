import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportService } from './report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Get('overview')
  async overview(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId;
    if (!tenantId) {
      return { totalOrders: 0, revenue: 0, totalTransactions: 0, activityCount: 0 };
    }
    return this.reports.overview(tenantId);
  }

  @Get('products')
  async getProductReport(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId;
    if (!tenantId) {
      return [];
    }
    return this.reports.getProductReport(tenantId);
  }

  @Get('customers')
  async getCustomerReport(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId;
    if (!tenantId) {
      return [];
    }
    return this.reports.getCustomerReport(tenantId);
  }

  @Get('payments')
  async getPaymentReport(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId;
    if (!tenantId) {
      return [];
    }
    return this.reports.getPaymentReport(tenantId);
  }
}
