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
    return this.reports.overview(req.user.tenantId);
  }

  @Get('products')
  async getProductReport(@Request() req: any) {
    return this.reports.getProductReport(req.user.tenantId);
  }

  @Get('customers')
  async getCustomerReport(@Request() req: any) {
    return this.reports.getCustomerReport(req.user.tenantId);
  }

  @Get('payments')
  async getPaymentReport(@Request() req: any) {
    return this.reports.getPaymentReport(req.user.tenantId);
  }
}
