import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MasterAdminService } from './master-admin.service';
import { PlanType, Status } from '@prisma/client';
import { AdminApiKeyGuard } from '../guard/admin-api-key.guard';

@UseGuards(AdminApiKeyGuard)
@Controller('admin/master')
export class MasterAdminController {
  constructor(private readonly masterAdminService: MasterAdminService) {}

  // ==================== PLATFORM OVERVIEW ====================

  @Get('overview')
  async getPlatformOverview() {
    return this.masterAdminService.getPlatformOverview();
  }

  @Get('system-health')
  async getSystemHealth() {
    return this.masterAdminService.getSystemHealth();
  }

  @Get('stats')
  async getPlatformStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.masterAdminService.getPlatformStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ==================== TENANT MANAGEMENT ====================

  @Get('tenants')
  async getAllTenants(
    @Query('plan') plan?: PlanType,
    @Query('status') status?: Status,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.masterAdminService.getAllTenants({
      plan,
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    return this.masterAdminService.getTenantById(id);
  }

  @Post('tenants')
  async createTenant(
    @Body()
    data: {
      name: string;
      subdomain: string;
      plan?: PlanType;
      description?: string;
      ownerEmail: string;
      ownerPassword: string;
    },
  ) {
    return this.masterAdminService.createTenant(data);
  }

  @Put('tenants/:id')
  async updateTenant(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      subdomain?: string;
      plan?: PlanType;
      status?: Status;
      description?: string;
      settings?: any;
    },
  ) {
    return this.masterAdminService.updateTenant(id, data);
  }

  @Post('tenants/:id/suspend')
  async suspendTenant(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.masterAdminService.suspendTenant(id, reason);
  }

  @Post('tenants/:id/activate')
  async activateTenant(@Param('id') id: string) {
    return this.masterAdminService.activateTenant(id);
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string) {
    return this.masterAdminService.deleteTenant(id);
  }

  @Post('tenants/:id/change-plan')
  async changeTenantPlan(
    @Param('id') id: string,
    @Body('plan') plan: PlanType,
  ) {
    return this.masterAdminService.changeTenantPlan(id, plan);
  }

  // ==================== PAYMENT GATEWAY MANAGEMENT ====================

  @Get('payment-gateways')
  async getPaymentGateways(@Query('tenantId') tenantId?: string) {
    return this.masterAdminService.getPaymentGateways(tenantId);
  }

  @Post('payment-gateways')
  async createPaymentGateway(
    @Body()
    data: {
      tenantId?: string | null;
      provider: string;
      name: string;
      credentials?: any;
      settings?: any;
    },
  ) {
    return this.masterAdminService.createPaymentGateway(data);
  }

  @Put('payment-gateways/:id')
  async updatePaymentGateway(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      credentials?: any;
      settings?: any;
      isActive?: boolean;
    },
  ) {
    return this.masterAdminService.updatePaymentGateway(id, data);
  }

  @Post('payment-gateways/:id/toggle')
  async togglePaymentGateway(@Param('id') id: string) {
    return this.masterAdminService.togglePaymentGateway(id);
  }

  @Delete('payment-gateways/:id')
  async deletePaymentGateway(@Param('id') id: string) {
    return this.masterAdminService.deletePaymentGateway(id);
  }

  @Get('payment-gateways/:id/stats')
  async getPaymentGatewayStats(@Param('id') id: string) {
    return this.masterAdminService.getPaymentGatewayStats(id);
  }

  // ==================== PARTNER MANAGEMENT ====================

  @Get('partners')
  async getAllPartners(
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.masterAdminService.getAllPartners({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });
  }

  @Get('partners/:id')
  async getPartnerById(@Param('id') id: string) {
    return this.masterAdminService.getPartnerById(id);
  }

  @Post('partners')
  async createPartner(
    @Body()
    data: {
      name: string;
      nameAr: string;
      email: string;
      phone: string;
      commissionType: 'PERCENTAGE' | 'FIXED';
      commissionValue: number;
      contactPerson?: string;
      settings?: any;
    },
  ) {
    return this.masterAdminService.createPartner(data);
  }

  @Put('partners/:id')
  async updatePartner(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      nameAr?: string;
      email?: string;
      phone?: string;
      commissionType?: 'PERCENTAGE' | 'FIXED';
      commissionValue?: number;
      contactPerson?: string;
      settings?: any;
      isActive?: boolean;
    },
  ) {
    return this.masterAdminService.updatePartner(id, data);
  }

  @Delete('partners/:id')
  async deletePartner(@Param('id') id: string) {
    return this.masterAdminService.deletePartner(id);
  }

  @Get('partners/:id/stats')
  async getPartnerStats(@Param('id') id: string) {
    return this.masterAdminService.getPartnerStats(id);
  }

  // ==================== SECURITY EVENTS ====================

  @Get('security-events')
  async getSecurityEvents(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.masterAdminService.getSecurityEvents({
      userId,
      action,
      resource,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ==================== AUDIT LOGS ====================

  @Get('audit-logs')
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.masterAdminService.getAuditLogs({
      userId,
      action,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ==================== ERROR LOGS ====================

  @Get('error-logs')
  async getErrorLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.masterAdminService.getErrorLogs({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
  // ==================== PLANS MANAGEMENT ====================

  @Get('plans')
  async getAllPlans() {
    return this.masterAdminService.getAllPlans();
  }

  @Post('plans')
  async createPlan(@Body() data: any) {
    return this.masterAdminService.createPlan(data);
  }

  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() data: any) {
    return this.masterAdminService.updatePlan(id, data);
  }

  @Post('plans/:id/toggle')
  async togglePlan(@Param('id') id: string) {
    return this.masterAdminService.togglePlan(id);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    return this.masterAdminService.deletePlan(id);
  }

  // ==================== FEATURE CONTROL ====================

  @Get('features')
  async getAllFeatures() {
    return this.masterAdminService.getAllFeatures();
  }

  @Post('features')
  async createFeature(@Body() data: any) {
    return this.masterAdminService.createFeature(data);
  }

  @Put('features/:id')
  async updateFeature(@Param('id') id: string, @Body() data: any) {
    return this.masterAdminService.updateFeature(id, data);
  }

  @Post('features/:id/toggle')
  async toggleFeature(@Param('id') id: string) {
    return this.masterAdminService.toggleFeature(id);
  }

  @Get('feature-overrides')
  async getFeatureOverrides() {
    return this.masterAdminService.getFeatureOverrides();
  }

  @Post('feature-overrides')
  async createFeatureOverride(@Body() data: any) {
    return this.masterAdminService.createFeatureOverride(data);
  }

  @Delete('feature-overrides/:id')
  async deleteFeatureOverride(@Param('id') id: string) {
    return this.masterAdminService.deleteFeatureOverride(id);
  }

  // ==================== USER GIFTS ====================

  @Get('gifts')
  async getAllGifts() {
    return this.masterAdminService.getAllGifts();
  }

  @Post('gifts')
  async grantGift(@Body() data: any) {
    return this.masterAdminService.grantGift(data);
  }

  @Post('gifts/:id/revoke')
  async revokeGift(@Param('id') id: string) {
    return this.masterAdminService.revokeGift(id);
  }

  @Get('users')
  async getAllUsers(@Query('limit') limit?: string) {
    return this.masterAdminService.getAllUsers(limit ? parseInt(limit) : undefined);
  }

  // ==================== CUSTOMER MANAGEMENT ====================

  @Get('customers')
  async getCustomers() {
    return this.masterAdminService.getCustomers();
  }

  // ==================== AI CONFIGURATION ====================

  @Get('ai-script')
  async getGlobalAiScript() {
    return this.masterAdminService.getGlobalAiScript();
  }

  @Post('ai-script')
  async updateGlobalAiScript(@Body() data: { script: string }) {
    return this.masterAdminService.updateGlobalAiScript(data.script);
  }

  // ==================== DATABASE MANAGEMENT ====================

  @Post('reset-database')
  async resetDatabase() {
    return this.masterAdminService.resetDatabase();
  }
}
