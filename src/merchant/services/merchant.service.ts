import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMerchantProfileDto, MerchantSettingsDto } from '../dto';
import { UserService } from '../../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MerchantService {
  private readonly logger = new Logger(MerchantService.name);

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  // Get or create merchant for user
  async getOrCreateMerchant(tenantId: string, userId: string, data?: { businessName?: string; businessNameAr?: string; email?: string; name?: string; role?: string }) {
    let merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!merchant) {
      // CRITICAL: Verify tenant exists before creating merchant (to avoid foreign key constraint)
      // Retry check up to 5 times with delays (handles potential transaction timing issues)
      let tenant = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        if (tenant) {
          this.logger.log(`Tenant ${tenantId} found on attempt ${attempt + 1}`);
          break;
        }
        if (attempt < 4) {
          // Wait before retry (increasing delay: 50ms, 100ms, 200ms, 300ms)
          const delay = 50 * Math.pow(2, attempt);
          this.logger.warn(`Tenant ${tenantId} not found on attempt ${attempt + 1}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!tenant) {
        this.logger.error(`Tenant ${tenantId} does not exist after 5 attempts. Cannot create merchant.`);
        throw new NotFoundException(`Tenant ${tenantId} not found. Please create tenant first.`);
      }

      // Ensure user exists in core database (sync from auth if needed)
      let user = await this.prisma.user.findUnique({ where: { id: userId } });
      
      if (!user) {
        // User doesn't exist in core database, sync from auth
        if (data?.email) {
          this.logger.log(`User ${userId} not found in core database, syncing from auth...`);
          user = await this.userService.ensureUserExists(userId, {
            email: data.email,
            name: data.name,
            role: data.role || 'SHOP_OWNER',
            tenantId: tenantId, // Safe to pass now since tenant exists
          });
        } else {
          throw new NotFoundException('User not found in core database. Please ensure user is synced from auth service.');
        }
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

      this.logger.log(`Created merchant ${merchant.id} for user ${userId} in tenant ${tenantId}`);
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

