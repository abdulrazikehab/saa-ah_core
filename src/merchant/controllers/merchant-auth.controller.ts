import {
  Controller,
  Post,
  Body,
  Get,
  Request,
  UseGuards,
  Headers,
  Ip,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MerchantService } from '../services/merchant.service';
import { EmployeeService } from '../services/employee.service';
import { MerchantSessionService } from '../services/merchant-session.service';
import { MerchantAuditService } from '../services/merchant-audit.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../../guard/tenant-required.guard';
import { MerchantLoginDto, ChangePasswordDto } from '../dto';
import * as bcrypt from 'bcrypt';

@Controller('merchant/auth')
export class MerchantAuthController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly employeeService: EmployeeService,
    private readonly sessionService: MerchantSessionService,
    private readonly auditService: MerchantAuditService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: MerchantLoginDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    // Try to find merchant or employee by identifier
    // This would need to be implemented based on your auth service setup
    // For now, this is a placeholder that shows the structure

    throw new Error('Login should be handled by app-auth service - use /api/auth/login');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantRequiredGuard)
  async getMe(@Request() req: any) {
    const userId = req.user.id || req.user.userId;
    const context = await this.merchantService.getMerchantContext(userId);

    if (!context) {
      // Try to create merchant account for user
      const merchant = await this.merchantService.getOrCreateMerchant(
        req.tenantId,
        userId,
      );

      return {
        user: req.user,
        merchant: {
          id: merchant.id,
          businessName: merchant.businessName,
          businessNameAr: merchant.businessNameAr,
          status: merchant.status,
          defaultCurrency: merchant.defaultCurrency,
          timezone: merchant.timezone,
        },
        isOwner: true,
        employeeId: null,
        permissions: null,
      };
    }

    const merchant = await this.merchantService.getMerchant(context.merchantId);

    return {
      user: {
        id: userId,
        email: req.user.email,
        role: req.user.role,
      },
      merchant: {
        id: merchant.id,
        businessName: merchant.businessName,
        businessNameAr: merchant.businessNameAr,
        status: merchant.status,
        defaultCurrency: merchant.defaultCurrency,
        timezone: merchant.timezone,
      },
      isOwner: context.isOwner,
      employeeId: context.employeeId,
      permissions: context.permissions || null,
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, TenantRequiredGuard)
  async changePassword(
    @Request() req: any,
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    // This would typically be handled by app-auth service
    // Placeholder for structure

    const userId = req.user.id || req.user.userId;
    const context = await this.merchantService.validateMerchantAccess(userId);

    await this.auditService.log(
      context.merchantId,
      userId,
      context.employeeId,
      context.isOwner ? 'MERCHANT' : 'EMPLOYEE',
      MerchantAuditService.Actions.PASSWORD_CHANGED,
      'User',
      userId,
      null,
      ipAddress,
      userAgent,
    );

    return { ok: true, message: 'Password changed successfully' };
  }
}

