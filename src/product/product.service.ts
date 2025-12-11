import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSyncService } from '../tenant/tenant-sync.service'; // Add this import
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private prisma: PrismaService,
    private tenantSyncService: TenantSyncService, // Add this dependency
  ) {}

 async create(tenantId: string, createProductDto: CreateProductDto, upsert?: boolean): Promise<ProductResponseDto> {
  if (!tenantId) {
    throw new ForbiddenException('Tenant ID is required');
  }

  this.logger.log(`🔄 Creating product for tenant: ${tenantId}${upsert ? ' (upsert mode)' : ''}`);

  // FIRST: Ensure tenant exists in core database
  try {
    await this.tenantSyncService.ensureTenantExists(tenantId);
    this.logger.log(`✅ Tenant verified: ${tenantId}`);
  } catch (error) {
    this.logger.error(`❌ Tenant synchronization failed:`, error);
    throw new ForbiddenException(`Cannot create product: Tenant ${tenantId} is not valid`);
  }

  const { variants, images, categoryIds, suppliers, supplierIds, ...productData } = createProductDto;

  // Check if SKU exists within tenant
  let existingProduct = null;
  if (productData.sku) {
    existingProduct = await this.prisma.product.findFirst({
      where: {
        tenantId,
        sku: productData.sku,
      },
    });

    if (existingProduct) {
      if (upsert) {
        // If upsert mode, update the existing product
        this.logger.log(`🔄 SKU exists, updating product: ${existingProduct.id}`);
        return this.update(tenantId, existingProduct.id, createProductDto);
      } else {
        // If not upsert mode, throw conflict error
        throw new ConflictException('SKU must be unique within your store');
      }
    }
  }

  // Validate categories exist if provided
  let validCategoryIds: string[] = [];
  if (categoryIds && categoryIds.length > 0) {
    this.logger.log(`🔍 Validating categories: ${categoryIds.join(', ')}`);
    
    const existingCategories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        tenantId: tenantId, // Ensure categories belong to the same tenant
      },
      select: { id: true },
    });

    validCategoryIds = existingCategories.map((cat: { id: any; }) => cat.id);
    
    if (validCategoryIds.length !== categoryIds.length) {
      const invalidCategories = categoryIds.filter(id => !validCategoryIds.includes(id));
      this.logger.warn(`⚠️ Some categories do not exist or don't belong to tenant: ${invalidCategories.join(', ')}`);
    }

    if (validCategoryIds.length === 0) {
      this.logger.log(`ℹ️ No valid categories found, creating product without categories`);
    }
  }

  // Validate brand exists if provided
  if (productData.brandId) {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: productData.brandId,
        tenantId,
      },
    });
    if (!brand) {
      this.logger.warn(`⚠️ Brand ${productData.brandId} not found, creating product without brand`);
      delete productData.brandId;
    }
  }

  // Validate suppliers exist if provided
  let validSuppliers: Array<{ supplierId: string; discountRate?: number; isPrimary?: boolean }> = [];
  if (suppliers && suppliers.length > 0) {
    for (const supplierData of suppliers) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: supplierData.supplierId,
          tenantId,
          isActive: true,
        },
      });
      if (supplier) {
        validSuppliers.push({
          supplierId: supplierData.supplierId,
          discountRate: supplierData.discountRate || supplier.discountRate || 0,
          isPrimary: supplierData.isPrimary || false,
        });
      }
    }
  } else if (supplierIds && supplierIds.length > 0) {
    // If only supplierIds provided, use default discount rates
    const existingSuppliers = await this.prisma.supplier.findMany({
      where: {
        id: { in: supplierIds },
        tenantId,
        isActive: true,
      },
    });
    validSuppliers = existingSuppliers.map((s, index) => ({
      supplierId: s.id,
      discountRate: Number(s.discountRate),
      isPrimary: index === 0, // First supplier is primary by default
    }));
  }

  try {
    this.logger.log(`📦 Creating product in database...`);
    
    const product = await this.prisma.product.create({
      data: {
        ...productData,
        tenantId,
        variants: variants ? {
          create: variants.map(variant => ({
            ...variant,
          })),
        } : undefined,
        images: images ? {
          create: images.map((image, index) => ({
            ...image,
            sortOrder: image.sortOrder || index,
          })),
        } : undefined,
        // Only connect categories that actually exist
        categories: validCategoryIds.length > 0 ? {
          create: validCategoryIds.map(categoryId => ({
            category: {
              connect: { id: categoryId },
            },
          })),
        } : undefined,
        // Connect suppliers (only if relation exists)
        ...(validSuppliers.length > 0 && {
          suppliers: {
            create: validSuppliers.map(s => ({
              supplierId: s.supplierId,
              discountRate: s.discountRate,
              isPrimary: s.isPrimary,
            })),
          },
        }),
        // Connect unit if provided
        ...(productData.unitId && { unitId: productData.unitId }),
      },
      include: (() => {
        const includeObj: any = {
          variants: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        };
        
        // Conditionally include suppliers and brand
        const productModel = (this.prisma as any)._dmmf?.datamodel?.models?.find((m: any) => m.name === 'Product');
        if (productModel) {
          const hasSuppliers = productModel.fields?.some((f: any) => f.name === 'suppliers');
          const hasBrand = productModel.fields?.some((f: any) => f.name === 'brand');
          
          if (hasSuppliers) {
            includeObj.suppliers = {
              include: {
                supplier: true,
              },
            };
          }
      if (hasBrand) {
        includeObj.brand = true;
      }
    }
    
    // Always try to include unit
    includeObj.unit = true;
    
    return includeObj;
  })(),
    });

    this.logger.log(`✅ Product created successfully: ${product.id}`);
    return this.mapToResponseDto(product);
  } catch (error) {
    this.logger.error(`❌ Product creation failed for tenant ${tenantId}:`, error);
    
    if (error === 'P2003') {
      // Foreign key constraint violation
      throw new ForbiddenException(`Cannot create product: Tenant ${tenantId} does not exist in the system`);
    }
    
    throw error;
  }
}

  async findAll(tenantId: string, page: number = 1, limit: number = 10, filters?: any) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Ensure tenant exists before querying
    await this.tenantSyncService.ensureTenantExists(tenantId);

    // Coerce query parameters to numbers to avoid NaN
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    this.logger.log(`📦 Finding products for tenant ${tenantId} with filters:`, filters);

    // Build where clause
    const where: any = { tenantId };
    
    // Apply category filter through junction table
    if (filters?.categoryId) {
      where.categories = {
        some: {
          categoryId: filters.categoryId,
        },
      };
      this.logger.log(`🔍 Filtering by categoryId: ${filters.categoryId}`);
    }
    
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }
    
    if (filters?.isActive !== undefined) {
      where.isAvailable = filters.isActive;
    }

    // Build include object - conditionally include new relations
    const include: any = {
      variants: true,
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
    };

    // Conditionally include suppliers and brand if schema supports them
    // Check if the relation fields exist in the Prisma schema
    const productModel = (this.prisma as any)._dmmf?.datamodel?.models?.find((m: any) => m.name === 'Product');
    if (productModel) {
      const hasSuppliers = productModel.fields?.some((f: any) => f.name === 'suppliers');
      const hasBrand = productModel.fields?.some((f: any) => f.name === 'brand');
      
      if (hasSuppliers) {
        include.suppliers = {
          include: {
            supplier: true,
          },
        };
      }
      if (hasBrand) {
        include.brand = true;
      }
    }
    
    // Always try to include unit
    include.unit = true;

    let products: any[];
    let total: number;

    try {
      // Try with full includes (suppliers, brand)
      [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include,
          skip,
          take: limitNum,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.product.count({
          where,
        }),
      ]);
    } catch (error: any) {
      // If relations don't exist yet, fall back to basic includes
      this.logger.warn('New relations not available, using basic query:', error.message);
      const basicInclude = {
        variants: true,
        images: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      };
      [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: basicInclude,
          skip,
          take: limitNum,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.product.count({
          where,
        }),
      ]);
    }

    this.logger.log(`📦 Fetched ${products.length} products for tenant ${tenantId} (total: ${total})`);
    if (products.length > 0) {
      this.logger.log(`Sample product data: ${JSON.stringify({
        id: products[0].id,
        name: products[0].name,
        price: products[0].price,
        priceType: typeof products[0].price,
        images: products[0].images?.length || 0,
        variants: products[0].variants?.length || 0,
        categories: products[0].categories?.length || 0
      })}`);
    }

    return {
      data: products.map((product: any) => this.mapToResponseDto(product)),
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<ProductResponseDto> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Ensure tenant exists
    await this.tenantSyncService.ensureTenantExists(tenantId);

    // Build include object - conditionally include new relations
    const includeObj: any = {
      variants: true,
      images: {
        orderBy: {
          sortOrder: 'asc',
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
    };

    // Conditionally include suppliers and brand
    const productModel = (this.prisma as any)._dmmf?.datamodel?.models?.find((m: any) => m.name === 'Product');
    if (productModel) {
      const hasSuppliers = productModel.fields?.some((f: any) => f.name === 'suppliers');
      const hasBrand = productModel.fields?.some((f: any) => f.name === 'brand');
      
      if (hasSuppliers) {
        includeObj.suppliers = {
          include: {
            supplier: true,
          },
        };
      }
      if (hasBrand) {
        includeObj.brand = true;
      }
    }
    
    // Always try to include unit
    includeObj.unit = true;

    let product: any;
    
    try {
      product = await this.prisma.product.findFirst({
        where: {
          id,
          tenantId,
        },
        include: includeObj,
      });
    } catch (error: any) {
      // Fall back to basic includes if relations don't exist
      this.logger.warn('New relations not available, using basic query:', error.message);
      product = await this.prisma.product.findFirst({
        where: {
          id,
          tenantId,
        },
        include: {
          variants: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
      });
    }

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToResponseDto(product);
  }

  async update(tenantId: string, id: string, updateProductDto: UpdateProductDto): Promise<ProductResponseDto> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Ensure tenant exists
    await this.tenantSyncService.ensureTenantExists(tenantId);

    // Verify product exists and belongs to tenant
    const existingProduct = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    const { variants, images, categoryIds, ...productData } = updateProductDto;

    // Check SKU uniqueness if provided
    if (productData.sku && productData.sku !== existingProduct.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: {
          tenantId,
          sku: productData.sku,
          NOT: { id },
        },
      });

      if (skuExists) {
        throw new ConflictException('SKU must be unique within your store');
      }
    }

    // Validate categories exist if provided
    let validCategoryIds: string[] = [];
    if (categoryIds && categoryIds.length > 0) {
      const existingCategories = await this.prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          tenantId: tenantId,
        },
        select: { id: true },
      });

      validCategoryIds = existingCategories.map((cat: { id: any; }) => cat.id);
      
      if (validCategoryIds.length !== categoryIds.length) {
        const invalidCategories = categoryIds.filter(id => !validCategoryIds.includes(id));
        this.logger.warn(`⚠️ Update product: Some categories do not exist or don't belong to tenant: ${invalidCategories.join(', ')}`);
      }
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...productData,
          // Always update variants if provided
          ...(variants !== undefined && {
            variants: {
              deleteMany: {}, // Remove existing variants
              create: variants.map(variant => ({
                ...variant,
              })),
            },
          }),
          // Always update images if provided
          ...(images !== undefined && {
            images: {
              deleteMany: {}, // Remove existing images
              create: images.map((image, index) => ({
                ...image,
                sortOrder: image.sortOrder || index,
              })),
            },
          }),
          // Always update categories if provided (even if empty array to clear categories)
          ...(categoryIds !== undefined && {
            categories: {
              deleteMany: {}, // Remove existing categories
              ...(validCategoryIds.length > 0 && {
                create: validCategoryIds.map(categoryId => ({
                  category: {
                    connect: { id: categoryId },
                  },
                })),
              }),
            },
          }),
        },
        include: {
          variants: true,
          images: {
            orderBy: {
              sortOrder: 'asc',
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
      });

      this.logger.log(`✅ Product updated successfully: ${id}`);
      return this.mapToResponseDto(product);
    } catch (error) {
      this.logger.error(`❌ Product update failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  async remove(tenantId: string, id: string): Promise<void> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Ensure tenant exists
    await this.tenantSyncService.ensureTenantExists(tenantId);

    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Delete all related records in a transaction to avoid foreign key constraint violations
    await this.prisma.$transaction(async (tx: any) => {
      // Delete product variants first
      await tx.productVariant.deleteMany({
        where: { productId: id },
      });

      // Delete product images
      await tx.productImage.deleteMany({
        where: { productId: id },
      });

      // Delete product-category associations
      await tx.productCategory.deleteMany({
        where: { productId: id },
      });

      // Delete product-supplier associations
      await tx.productSupplier.deleteMany({
        where: { productId: id },
      });

      // Finally, delete the product
      await tx.product.delete({
        where: { id },
      });
    });

    this.logger.log(`✅ Product deleted successfully: ${id}`);
  }

  async updateInventory(tenantId: string, variantId: string, quantity: number): Promise<void> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Ensure tenant exists
    await this.tenantSyncService.ensureTenantExists(tenantId);

    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        product: {
          tenantId,
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { inventoryQuantity: quantity },
    });
  }

  private mapToResponseDto(product: any): ProductResponseDto {
    const response = {
      id: product.id,
      tenantId: product.tenantId,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : undefined,
      costPerItem: product.costPerItem ? Number(product.costPerItem) : undefined,
      isAvailable: product.isAvailable,
      isPublished: product.isPublished,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      nameAr: product.nameAr,
      descriptionAr: product.descriptionAr,
      barcode: product.barcode,
      featured: product.featured,
      weight: product.weight ? Number(product.weight) : undefined,
      dimensions: product.dimensions,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      variants: product.variants?.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: Number(variant.price),
        compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : undefined,
        inventoryQuantity: variant.inventoryQuantity,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
      })),
      images: product.images?.map((image: any) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        sortOrder: image.sortOrder,
        createdAt: image.createdAt,
      })),
      categories: product.categories?.map((pc: any) => pc.category),
      productId: product.productId,
      odooProductId: product.odooProductId,
      brand: product.brand ? {
        id: product.brand.id,
        name: product.brand.name,
        nameAr: product.brand.nameAr,
        code: product.brand.code,
      } : undefined,
      suppliers: product.suppliers?.map((ps: any) => ({
        id: ps.id,
        supplierId: ps.supplierId,
        supplier: {
          id: ps.supplier.id,
          name: ps.supplier.name,
          nameAr: ps.supplier.nameAr,
          discountRate: Number(ps.supplier.discountRate),
        },
        discountRate: Number(ps.discountRate),
        isPrimary: ps.isPrimary,
      })),
      unit: product.unit ? {
        id: product.unit.id,
        name: product.unit.name,
        nameAr: product.unit.nameAr,
        code: product.unit.code,
        symbol: product.unit.symbol,
        cost: Number(product.unit.cost),
      } : undefined,
    };

    this.logger.debug(`Mapped product ${product.id}: price=${response.price}, images=${response.images?.length || 0}, variants=${response.variants?.length || 0}`);
    
    return response;
  }
}