import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMerchantProfileDto, MerchantSettingsDto } from '../dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(private prisma: PrismaService) {}

  // Get or create merchant for user
  async getOrCreateMerchant(tenantId: string, userId: string, data?: { businessName?: string; businessNameAr?: string }) {
    let merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!merchant) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      merchant = await this.prisma.merchant.create({
        data: {
          tenantId,
          userId,
          businessName: data?.businessName || user.name || 'My Business',
          businessNameAr: data?.businessNameAr,
          email: user.email,
          status: 'ACTIVE',
        },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      this.logger.log(`Created merchant ${merchant.id} for user ${userId}`);
    }

    return merchant;
  }

  // Get merchant by ID
  async getMerchant(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return merchant;
  }

  // Get merchant by user ID
  async getMerchantByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });

    return merchant;
  }

  // Update merchant profile
  async updateProfile(merchantId: string, dto: UpdateMerchantProfileDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const updated = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        businessName: dto.businessName,
        businessNameAr: dto.businessNameAr,
        phone: dto.phone,
        email: dto.email,
        timezone: dto.timezone,
        lowBalanceThreshold: dto.lowBalanceThreshold,
      },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    });

    this.logger.log(`Updated merchant profile ${merchantId}`);
    return updated;
  }

  // Update merchant settings
  async updateSettings(merchantId: string, dto: MerchantSettingsDto) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const currentSettings = (merchant.settings as any) || {};
    const newSettings = {
      ...currentSettings,
      ...dto,
    };

    const updated = await this.prisma.merchant.update({
      where: { id: merchantId },
      data: { settings: newSettings },
    });

    return updated.settings;
  }

  // Get merchant settings
  async getSettings(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { settings: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return merchant.settings || {
      locale: 'ar',
      theme: 'system',
      notificationPreferences: {
        orderUpdates: true,
        priceAlerts: true,
        promotions: true,
        lowBalance: true,
      },
    };
  }

  // Check if user is merchant owner or employee
  async getMerchantContext(userId: string) {
    // Check if user is a merchant owner
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      select: { id: true, tenantId: true, status: true },
    });

    if (merchant) {
      return {
        merchantId: merchant.id,
        tenantId: merchant.tenantId,
        isOwner: true,
        employeeId: null,
        status: merchant.status,
      };
    }

    // Check if user is an employee
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        merchant: { select: { id: true, tenantId: true, status: true } },
      },
    });

    if (employee) {
      return {
        merchantId: employee.merchantId,
        tenantId: employee.merchant.tenantId,
        isOwner: false,
        employeeId: employee.id,
        status: employee.merchant.status,
        permissions: employee.permissions,
      };
    }

    return null;
  }

  // Validate merchant access
  async validateMerchantAccess(userId: string, requiredPermission?: string) {
    const context = await this.getMerchantContext(userId);

    if (!context) {
      throw new NotFoundException('No merchant account found');
    }

    if (context.status !== 'ACTIVE') {
      throw new BadRequestException('Merchant account is not active');
    }

    // Check permission for employees
    if (!context.isOwner && requiredPermission) {
      const permissions = context.permissions as any;
      if (!permissions || !permissions[requiredPermission]) {
        throw new BadRequestException(`Permission denied: ${requiredPermission}`);
      }
    }

    return context;
  }

  // Get merchant wallet balance
  async getWalletBalance(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { userId: true, defaultCurrency: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: merchant.userId },
    });

    return {
      balance: wallet?.balance || 0,
      currency: merchant.defaultCurrency,
    };
  }
}

