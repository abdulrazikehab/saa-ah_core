// apps/app-core/src/currency/currency.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCurrencyDto {
  code: string;
  name: string;
  nameAr?: string;
  symbol: string;
  symbolAr?: string;
  exchangeRate: number;
  precision?: number; // Decimal places (default: 2)
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdateCurrencyDto {
  name?: string;
  nameAr?: string;
  symbol?: string;
  symbolAr?: string;
  exchangeRate?: number;
  precision?: number;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdateCurrencySettingsDto {
  baseCurrency: string;
  autoUpdateRates?: boolean;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: CreateCurrencyDto) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Check if currency code already exists for this tenant
    const existing = await this.prisma.currency.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: data.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Currency ${data.code} already exists`);
    }

    // If this currency is set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.currency.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const currency = await this.prisma.currency.create({
      data: {
        tenantId,
        code: data.code.toUpperCase(),
        name: data.name,
        nameAr: data.nameAr,
        symbol: data.symbol,
        symbolAr: data.symbolAr,
        exchangeRate: data.exchangeRate,
        precision: data.precision ?? 2,
        isDefault: data.isDefault ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    this.logger.log(`Currency created: ${currency.code} for tenant ${tenantId}`);
    return currency;
  }

  // Format amount according to currency precision
  formatAmount(amount: number, precision: number = 2): string {
    return amount.toFixed(precision);
  }

  // Round amount according to currency precision
  roundAmount(amount: number, precision: number = 2): number {
    const multiplier = Math.pow(10, precision);
    return Math.round(amount * multiplier) / multiplier;
  }

  // Get default currency for tenant
  async getDefaultCurrency(tenantId: string) {
    const currency = await this.prisma.currency.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });

    if (!currency) {
      // Fallback to SAR or first active currency
      return this.prisma.currency.findFirst({
        where: { 
          tenantId, 
          isActive: true,
          OR: [{ code: 'SAR' }, {}],
        },
        orderBy: [{ code: 'asc' }],
      });
    }

    return currency;
  }

  async findAll(tenantId: string, includeInactive: boolean = false) {
    const where: any = { tenantId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.currency.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(tenantId: string, code: string) {
    const currency = await this.prisma.currency.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: code.toUpperCase(),
        },
      },
    });

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    return currency;
  }

  async update(tenantId: string, code: string, data: UpdateCurrencyDto) {
    await this.findOne(tenantId, code);

    // If this currency is being set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.currency.updateMany({
        where: { tenantId, isDefault: true, NOT: { code: code.toUpperCase() } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.currency.update({
      where: {
        tenantId_code: {
          tenantId,
          code: code.toUpperCase(),
        },
      },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        symbol: data.symbol,
        symbolAr: data.symbolAr,
        exchangeRate: data.exchangeRate,
        precision: data.precision,
        isActive: data.isActive,
        isDefault: data.isDefault,
        sortOrder: data.sortOrder,
      },
    });

    this.logger.log(`Currency updated: ${code}`);
    return updated;
  }

  // Set a currency as default
  async setDefault(tenantId: string, code: string) {
    await this.findOne(tenantId, code);

    // Unset all other defaults
    await this.prisma.currency.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this one as default
    const updated = await this.prisma.currency.update({
      where: {
        tenantId_code: {
          tenantId,
          code: code.toUpperCase(),
        },
      },
      data: { isDefault: true },
    });

    // Also update currency settings
    await this.prisma.currencySettings.upsert({
      where: { tenantId },
      update: { baseCurrency: code.toUpperCase() },
      create: { tenantId, baseCurrency: code.toUpperCase() },
    });

    this.logger.log(`Currency ${code} set as default for tenant ${tenantId}`);
    return updated;
  }

  async remove(tenantId: string, code: string) {
    await this.findOne(tenantId, code);

    // Check if it's the base currency
    const settings = await this.getSettings(tenantId);
    if (settings?.baseCurrency === code.toUpperCase()) {
      throw new BadRequestException('Cannot delete base currency');
    }

    await this.prisma.currency.delete({
      where: {
        tenantId_code: {
          tenantId,
          code: code.toUpperCase(),
        },
      },
    });

    this.logger.log(`Currency deleted: ${code}`);
  }

  async getSettings(tenantId: string) {
    return this.prisma.currencySettings.findUnique({
      where: { tenantId },
    });
  }

  async updateSettings(tenantId: string, data: UpdateCurrencySettingsDto) {
    // Verify base currency exists
    const baseCurrency = await this.findOne(tenantId, data.baseCurrency);

    const settings = await this.prisma.currencySettings.upsert({
      where: { tenantId },
      update: {
        baseCurrency: data.baseCurrency.toUpperCase(),
        autoUpdateRates: data.autoUpdateRates ?? false,
        lastUpdated: new Date(),
      },
      create: {
        tenantId,
        baseCurrency: data.baseCurrency.toUpperCase(),
        autoUpdateRates: data.autoUpdateRates ?? false,
      },
    });

    // Update base currency exchange rate to 1
    await this.prisma.currency.update({
      where: {
        tenantId_code: {
          tenantId,
          code: baseCurrency.code,
        },
      },
      data: { exchangeRate: 1 },
    });

    // Sync currency to tenant.settings.currency (so Settings page shows the same currency)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = (tenant?.settings || {}) as Record<string, unknown>;
    const updatedSettings = {
      ...currentSettings,
      currency: data.baseCurrency.toUpperCase(),
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: updatedSettings },
    });

    this.logger.log(`Currency settings updated for tenant ${tenantId}`);
    return settings;
  }

  async updateExchangeRates(tenantId: string, rates: Record<string, number>) {
    const settings = await this.getSettings(tenantId);
    if (!settings) {
      throw new BadRequestException('Currency settings not configured');
    }

    const updates = Object.entries(rates).map(([code, rate]) =>
      this.prisma.currency.update({
        where: {
          tenantId_code: {
            tenantId,
            code: code.toUpperCase(),
          },
        },
        data: { exchangeRate: rate },
      })
    );

    await Promise.all(updates);

    await this.prisma.currencySettings.update({
      where: { tenantId },
      data: { lastUpdated: new Date() },
    });

    this.logger.log(`Exchange rates updated for tenant ${tenantId}`);
  }
}

