// apps/app-core/src/brand/brand.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBrandDto {
  name: string;
  nameAr?: string;
  code?: string;
  shortName?: string;
  brandType?: string;
  status?: string;
  rechargeUsdValue?: number;
  usdValueForCoins?: number;
  safetyStock?: number;
  leadTime?: number;
  reorderPoint?: number;
  averageConsumptionPerMonth?: number;
  averageConsumptionPerDay?: number;
  abcAnalysis?: string;
  odooCategoryId?: string;
}

export interface UpdateBrandDto {
  name?: string;
  nameAr?: string;
  code?: string;
  shortName?: string;
  brandType?: string;
  status?: string;
  rechargeUsdValue?: number;
  usdValueForCoins?: number;
  safetyStock?: number;
  leadTime?: number;
  reorderPoint?: number;
  averageConsumptionPerMonth?: number;
  averageConsumptionPerDay?: number;
  abcAnalysis?: string;
  odooCategoryId?: string;
}

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: CreateBrandDto) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // If a code is provided, make brand creation idempotent per (tenantId, code)
    // Return existing brand instead of throwing on duplicates.
    if (data.code) {
      const existingBrand = await this.prisma.brand.findFirst({
        where: {
          tenantId,
          code: data.code,
        },
      });

      if (existingBrand) {
        this.logger.log(
          `Brand already exists for tenant ${tenantId} with code ${data.code}. Returning existing brand.`,
        );
        return existingBrand;
      }
    }

    try {
      const brand = await this.prisma.brand.create({
        data: {
          tenantId,
          name: data.name,
          nameAr: data.nameAr,
          code: data.code,
          shortName: data.shortName,
          brandType: data.brandType,
          status: data.status || 'Active',
          rechargeUsdValue: data.rechargeUsdValue || 0,
          usdValueForCoins: data.usdValueForCoins || 0,
          safetyStock: data.safetyStock || 0,
          leadTime: data.leadTime || 0,
          reorderPoint: data.reorderPoint || 0,
          averageConsumptionPerMonth: data.averageConsumptionPerMonth || 0,
          averageConsumptionPerDay: data.averageConsumptionPerDay || 0,
          abcAnalysis: data.abcAnalysis,
          odooCategoryId: data.odooCategoryId,
        },
      });

      this.logger.log(`Brand created: ${brand.id} for tenant ${tenantId}`);
      return brand;
    } catch (error: any) {
      // Handle unique constraint on (tenantId, code)
      if (error?.code === 'P2002' && data.code) {
        this.logger.warn(
          `Duplicate brand code detected for tenant ${tenantId}: ${data.code}`,
        );

        // In case of race condition, try to load existing brand and return it
        const existingBrand = await this.prisma.brand.findFirst({
          where: {
            tenantId,
            code: data.code,
          },
        });

        if (existingBrand) {
          return existingBrand;
        }

        // Fallback: return a clear validation error
        throw new BadRequestException(
          'A brand with this code already exists for your store. Please use a different code.',
        );
      }

      throw error;
    }
  }

  async findAll(tenantId: string) {
    if (!tenantId) {
      return [];
    }
    try {
      return await this.prisma.brand.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      // If tenant doesn't exist in database, return empty array
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        this.logger.warn(`⚠️ Tenant ${tenantId} does not exist in database. Returning empty brands list.`);
        return [];
      }
      throw error;
    }
  }

  async findOne(tenantId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async findByCode(tenantId: string, code: string) {
    return this.prisma.brand.findFirst({
      where: {
        tenantId,
        code,
      },
    });
  }

  async update(tenantId: string, id: string, data: UpdateBrandDto) {
    await this.findOne(tenantId, id);

    const updated = await this.prisma.brand.update({
      where: { id },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        code: data.code,
        shortName: data.shortName,
        brandType: data.brandType,
        status: data.status,
        rechargeUsdValue: data.rechargeUsdValue,
        usdValueForCoins: data.usdValueForCoins,
        safetyStock: data.safetyStock,
        leadTime: data.leadTime,
        reorderPoint: data.reorderPoint,
        averageConsumptionPerMonth: data.averageConsumptionPerMonth,
        averageConsumptionPerDay: data.averageConsumptionPerDay,
        abcAnalysis: data.abcAnalysis,
        odooCategoryId: data.odooCategoryId,
      },
    });

    this.logger.log(`Brand updated: ${id}`);
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    // Check if brand is used in any products
    const productCount = await this.prisma.product.count({
      where: {
        brandId: id,
        tenantId,
      },
    });

    if (productCount > 0) {
      throw new BadRequestException('Cannot delete brand that is used in products');
    }

    await this.prisma.brand.delete({
      where: { id },
    });

    this.logger.log(`Brand deleted: ${id}`);
  }
}

