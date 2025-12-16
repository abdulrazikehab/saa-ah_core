// apps/app-core/src/supplier/supplier.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSupplierDto {
  name: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  discountRate?: number;
  notes?: string;
  // API Configuration
  apiEndpoint?: string;
  apiKey?: string;
  apiConfig?: any;
  autoPurchaseEnabled?: boolean;
  priceCheckInterval?: number;
}

export interface UpdateSupplierDto {
  name?: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  discountRate?: number;
  isActive?: boolean;
  notes?: string;
  // API Configuration
  apiEndpoint?: string;
  apiKey?: string;
  apiConfig?: any;
  autoPurchaseEnabled?: boolean;
  priceCheckInterval?: number;
}

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: CreateSupplierDto) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId,
        name: data.name,
        nameAr: data.nameAr,
        email: data.email,
        phone: data.phone,
        contactPerson: data.contactPerson,
        address: data.address,
        discountRate: data.discountRate || 0,
        notes: data.notes,
        apiEndpoint: data.apiEndpoint,
        apiKey: data.apiKey,
        apiConfig: data.apiConfig,
        autoPurchaseEnabled: data.autoPurchaseEnabled || false,
        priceCheckInterval: data.priceCheckInterval,
      },
    });

    this.logger.log(`Supplier created: ${supplier.id} for tenant ${tenantId}`);
    return supplier;
  }

  async findAll(tenantId: string, includeInactive: boolean = false) {
    const where: any = { tenantId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.supplier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(tenantId: string, id: string, data: UpdateSupplierDto) {
    const supplier = await this.findOne(tenantId, id);

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        email: data.email,
        phone: data.phone,
        contactPerson: data.contactPerson,
        address: data.address,
        discountRate: data.discountRate,
        isActive: data.isActive,
        notes: data.notes,
        apiEndpoint: data.apiEndpoint,
        apiKey: data.apiKey,
        apiConfig: data.apiConfig,
        autoPurchaseEnabled: data.autoPurchaseEnabled,
        priceCheckInterval: data.priceCheckInterval,
      },
    });

    this.logger.log(`Supplier updated: ${id}`);
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    // Check if supplier is used in any products
    const productCount = await this.prisma.productSupplier.count({
      where: {
        supplierId: id,
        product: {
          tenantId,
        },
      },
    });

    if (productCount > 0) {
      // Soft delete by setting isActive to false
      const updated = await this.prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
      this.logger.log(`Supplier soft deleted (deactivated): ${id} - used in ${productCount} products`);
      return updated;
    }

    await this.prisma.supplier.delete({
      where: { id },
    });

    this.logger.log(`Supplier hard deleted: ${id}`);
    return { id, deleted: true };
  }
}

