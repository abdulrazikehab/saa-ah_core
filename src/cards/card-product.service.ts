import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateCardProductDto {
  brandId?: string;
  categoryId?: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  image?: string;
  productCode?: string;
  denomination: number;
  currency?: string;
  wholesalePrice: number;
  retailPrice: number;
  profitMargin?: number;
  taxRate?: number;
  isActive?: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  sortOrder?: number;
}

export interface UpdateCardProductDto extends Partial<CreateCardProductDto> {
  isAvailable?: boolean;
  stockCount?: number;
}

export interface CardProductFilter {
  brandId?: string;
  categoryId?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
}

@Injectable()
export class CardProductService {
  private readonly logger = new Logger(CardProductService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, data: CreateCardProductDto) {
    // Check for duplicate product code
    if (data.productCode) {
      const existing = await this.prisma.cardProduct.findUnique({
        where: {
          tenantId_productCode: {
            tenantId,
            productCode: data.productCode,
          },
        },
      });
      if (existing) {
        throw new ConflictException(`Product with code ${data.productCode} already exists`);
      }
    }

    const product = await this.prisma.cardProduct.create({
      data: {
        tenantId,
        brandId: data.brandId,
        categoryId: data.categoryId,
        name: data.name,
        nameAr: data.nameAr,
        description: data.description,
        descriptionAr: data.descriptionAr,
        image: data.image,
        productCode: data.productCode,
        denomination: data.denomination,
        currency: data.currency || 'SAR',
        wholesalePrice: data.wholesalePrice,
        retailPrice: data.retailPrice,
        profitMargin: data.profitMargin || 0,
        taxRate: data.taxRate || 0.15,
        isActive: data.isActive ?? true,
        minQuantity: data.minQuantity || 1,
        maxQuantity: data.maxQuantity || 100,
        sortOrder: data.sortOrder || 0,
      },
      include: {
        brand: true,
        category: true,
      },
    });

    this.logger.log(`Created card product ${product.id}: ${product.name}`);
    return product;
  }

  async findAll(
    tenantId: string,
    filter: CardProductFilter = {},
    page: number = 1,
    limit: number = 20,
  ) {
    const where: Prisma.CardProductWhereInput = {
      tenantId,
    };

    if (filter.brandId) {
      where.brandId = filter.brandId;
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.isAvailable !== undefined) {
      where.isAvailable = filter.isAvailable;
    }
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { nameAr: { contains: filter.search, mode: 'insensitive' } },
        { productCode: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.minPrice || filter.maxPrice) {
      where.wholesalePrice = {};
      if (filter.minPrice) {
        where.wholesalePrice.gte = filter.minPrice;
      }
      if (filter.maxPrice) {
        where.wholesalePrice.lte = filter.maxPrice;
      }
    }

    const [products, total] = await Promise.all([
      this.prisma.cardProduct.findMany({
        where,
        include: {
          brand: true,
          category: true,
          _count: {
            select: {
              inventory: { where: { status: 'AVAILABLE' } },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.cardProduct.count({ where }),
    ]);

    // Add available stock count to each product
    const productsWithStock = products.map((product) => ({
      ...product,
      availableStock: product._count.inventory,
    }));

    return {
      data: productsWithStock,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.cardProduct.findFirst({
      where: { id, tenantId },
      include: {
        brand: true,
        category: true,
        _count: {
          select: {
            inventory: { where: { status: 'AVAILABLE' } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return {
      ...product,
      availableStock: product._count.inventory,
    };
  }

  async update(tenantId: string, id: string, data: UpdateCardProductDto) {
    await this.findOne(tenantId, id);

    const product = await this.prisma.cardProduct.update({
      where: { id },
      data,
      include: {
        brand: true,
        category: true,
      },
    });

    this.logger.log(`Updated card product ${product.id}: ${product.name}`);
    return product;
  }

  async delete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.cardProduct.delete({
      where: { id },
    });

    this.logger.log(`Deleted card product ${id}`);
    return { success: true };
  }

  // Update stock count based on inventory
  async updateStockCount(productId: string) {
    const count = await this.prisma.cardInventory.count({
      where: { productId, status: 'AVAILABLE' },
    });

    await this.prisma.cardProduct.update({
      where: { id: productId },
      data: {
        stockCount: count,
        isAvailable: count > 0,
      },
    });

    return count;
  }

  // Get products by brand
  async findByBrand(tenantId: string, brandId: string) {
    return this.prisma.cardProduct.findMany({
      where: {
        tenantId,
        brandId,
        isActive: true,
        isAvailable: true,
      },
      include: {
        brand: true,
        _count: {
          select: {
            inventory: { where: { status: 'AVAILABLE' } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { denomination: 'asc' }],
    });
  }

  // Get products by category
  async findByCategory(tenantId: string, categoryId: string) {
    return this.prisma.cardProduct.findMany({
      where: {
        tenantId,
        categoryId,
        isActive: true,
        isAvailable: true,
      },
      include: {
        brand: true,
        category: true,
        _count: {
          select: {
            inventory: { where: { status: 'AVAILABLE' } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { denomination: 'asc' }],
    });
  }

  // Get all brands with product counts
  async getBrandsWithProducts(tenantId: string) {
    const brands = await this.prisma.brand.findMany({
      where: {
        tenantId,
        status: 'Active',
      },
      include: {
        _count: {
          select: {
            cardProducts: {
              where: { isActive: true, isAvailable: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return brands.map((brand) => ({
      ...brand,
      productCount: brand._count.cardProducts,
    }));
  }

  // Get all categories with product counts
  async getCategoriesWithProducts(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            cardProducts: {
              where: { isActive: true, isAvailable: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => ({
      ...category,
      productCount: category._count.cardProducts,
    }));
  }
}

