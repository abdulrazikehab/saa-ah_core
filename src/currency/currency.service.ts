// apps/app-core/src/currency/currency.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCurrencyDto {
  code: string;
  name: string;
  nameAr?: string;
  symbol: string;
  exchangeRate: number;
}

export interface UpdateCurrencyDto {
  name?: string;
  nameAr?: string;
  symbol?: string;
  exchangeRate?: number;
  isActive?: boolean;
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

    const currency = await this.prisma.currency.create({
      data: {
        tenantId,
        code: data.code.toUpperCase(),
        name: data.name,
        nameAr: data.nameAr,
        symbol: data.symbol,
        exchangeRate: data.exchangeRate,
      },
    });

    this.logger.log(`Currency created: ${currency.code} for tenant ${tenantId}`);
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
        exchangeRate: data.exchangeRate,
        isActive: data.isActive,
      },
    });

    this.logger.log(`Currency updated: ${code}`);
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

