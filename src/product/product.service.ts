import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
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

  /**
   * Generate a SKU based on product name and tenant.
   *
   * Rules:
   * - Prefix = first two letters of first two words of the English name (lowercase),
   *   fallback to 'pr' if not available.
   * - If word has only one letter, take that letter. If word has 2+ letters, take first 2 letters.
   * - Suffix = 3‑digit sequence per tenant+prefix (001, 002, 003, ...).
   * - Ensures uniqueness per tenant by always picking the next available number.
   * 
   * Example: "Product Name" -> "pron001", "pron002", etc.
   * Example: "Product" -> "pr001" (single word, first 2 chars)
   * Example: "A B" -> "ab001" (two single-letter words)
   */
  private async generateSku(tenantId: string, name: string): Promise<string> {
    const rawName = (name || '').trim().toLowerCase();
    
    // Extract first two words
    const words = rawName.split(/\s+/).filter(w => w.length > 0);
    let prefix = 'pr'; // default fallback
    
    if (words.length >= 2) {
      // Use first letter of first two words (as per user requirement: "wx pu001" pattern)
      const firstWord = words[0].replace(/[^a-z0-9]/g, '');
      const secondWord = words[1].replace(/[^a-z0-9]/g, '');
      
      const firstChar = firstWord.charAt(0) || '';
      const secondChar = secondWord.charAt(0) || '';
      
      if (firstChar && secondChar) {
        prefix = firstChar + secondChar;
      } else if (firstChar) {
        prefix = firstChar + 'x';
      }
    } else if (words.length === 1) {
      // If only one word, use first two characters
      const word = words[0].replace(/[^a-z0-9]/g, '');
      if (word.length >= 2) {
        prefix = word.substring(0, 2);
      } else if (word.length === 1) {
        prefix = word + 'x';
      }
    }

    // Find the last SKU for this tenant + prefix, ordered descending
    const lastWithPrefix = await this.prisma.product.findFirst({
      where: {
        tenantId,
        sku: {
          startsWith: prefix,
        },
      },
      orderBy: {
        sku: 'desc',
      },
      select: {
        sku: true,
      },
    });

    let nextNumber = 1;
    if (lastWithPrefix?.sku && lastWithPrefix.sku.length > prefix.length) {
      const numericPart = lastWithPrefix.sku.substring(prefix.length);
      const parsed = parseInt(numericPart, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        nextNumber = parsed + 1;
      }
    }

    const sku = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    this.logger.log(`Generated SKU "${sku}" for product "${name}" (tenant: ${tenantId})`);
    return sku;
  }

  async create(tenantId: string, createProductDto: CreateProductDto, upsert?: boolean): Promise<ProductResponseDto> {
  if (!tenantId) {
    this.logger.error('❌ Product creation failed: tenantId is null or undefined');
    throw new ForbiddenException('Tenant ID is required. Please ensure you are authenticated and have a market set up.');
  }

  this.logger.log(`🔄 Creating product for tenant: ${tenantId}${upsert ? ' (upsert mode)' : ''}`);

  // FIRST: Check if tenant exists (don't create if it doesn't - just verify)
  try {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    
    if (!existingTenant) {
      this.logger.error(`❌ Tenant ${tenantId} does not exist in database`);
      throw new ForbiddenException(
        `Cannot create product: Tenant ${tenantId} does not exist. Please set up your market first by going to Market Setup.`
      );
    }
    this.logger.log(`✅ Tenant verified: ${tenantId}`);
  } catch (error: any) {
    if (error instanceof ForbiddenException) {
      throw error;
    }
    this.logger.error(`❌ Error checking tenant ${tenantId}:`, error);
    throw new ForbiddenException(`Cannot create product: Failed to verify tenant. Please try again or contact support.`);
  }

  const { variants, images, categoryIds, suppliers, supplierIds, tags, ...productData } = createProductDto;

  // Auto-generate SKU if not provided
  if (!productData.sku || !productData.sku.trim()) {
    productData.sku = await this.generateSku(tenantId, productData.name);
  }

  // Check if SKU exists within tenant
  let existingProduct: { id: string } | null = null;
  if (productData.sku) {
    existingProduct = await this.prisma.product.findFirst({
      where: {
        tenantId,
        sku: productData.sku,
      },
    }) as { id: string } | null;

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
    validSuppliers = existingSuppliers.map((s: any, index: number) => ({
      supplierId: s.id,
      discountRate: Number(s.discountRate),
      isPrimary: index === 0, // First supplier is primary by default
    }));
  }

  // Process tags: create or find ProductTag records and prepare tagItems
  let tagItemsData: Array<{ tagId: string }> = [];
  if (tags && tags.length > 0) {
    this.logger.log(`🏷️ Processing tags: ${tags.join(', ')}`);
    
    // Helper function to create slug from tag name
    const createSlug = (name: string): string => {
      return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    };

    for (const tagName of tags) {
      if (!tagName || !tagName.trim()) continue;
      
      const tagSlug = createSlug(tagName);
      
      // Find or create ProductTag
      let productTag = await this.prisma.productTag.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug: tagSlug,
          },
        },
      });

      if (!productTag) {
        // Create new tag
        productTag = await this.prisma.productTag.create({
          data: {
            tenantId,
            name: tagName.trim(),
            slug: tagSlug,
          },
        });
        this.logger.log(`✅ Created new tag: ${productTag.name} (${productTag.slug})`);
      }

      tagItemsData.push({ tagId: productTag.id });
    }
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
        // Connect tags through tagItems relationship
        ...(tagItemsData.length > 0 && {
          tagItems: {
            create: tagItemsData,
          },
        }),
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
        
        // Include tags
        includeObj.tagItems = {
          include: {
            tag: true,
          },
        };
        
        return includeObj;
      })(),
    });

    this.logger.log(`✅ Product created successfully: ${product.id}`);
    return this.mapToResponseDto(product);
  } catch (error: any) {
    this.logger.error(`❌ Product creation failed for tenant ${tenantId}:`, error);
    
    // Handle unique constraint violation (race condition with concurrent imports)
    if (error?.code === 'P2002' && upsert && productData.sku) {
      this.logger.log(`🔄 Unique constraint violation in upsert mode, retrying as update...`);
      
      // Find the existing product and update it
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          tenantId,
          sku: productData.sku,
        },
        select: { id: true },
      });
      
      if (existingProduct) {
        return this.update(tenantId, existingProduct.id, createProductDto);
      }
    }
    
    // Handle P2002 without upsert - throw user-friendly error
    if (error?.code === 'P2002') {
      const targets = error.meta?.target || [];
      if (targets.includes('sku') || targets.includes('tenantId_sku')) {
        throw new ConflictException('SKU must be unique within your store. A product with this SKU already exists.');
      }
      throw new ConflictException(`A product with these values already exists: ${targets.join(', ')}`);
    }
    
    // Foreign key constraint violation
    if (error?.code === 'P2003') {
      throw new ForbiddenException(`Cannot create product: Tenant ${tenantId} does not exist in the system`);
    }
    
    throw error;
  }
}

  async findAll(tenantId: string, page: number = 1, limit: number = 10, filters?: any) {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Check if tenant exists before querying
    const tenantExists = await this.tenantSyncService.ensureTenantExists(tenantId);
    if (!tenantExists) {
      // If tenant doesn't exist and can't be created, return empty result
      this.logger.warn(`⚠️ Tenant ${tenantId} does not exist. Returning empty products list.`);
      return {
        data: [],
        meta: {
          total: 0,
          page: Number(page) || 1,
          limit: Number(limit) || 10,
          totalPages: 0,
        },
      };
    }

    // Coerce query parameters to numbers to avoid NaN
    const pageNum = Number(page) || 1;
    let limitNum = Number(limit) || 10;
    
    // Safety: Enforce maximum limit to prevent CPU/memory issues
    const MAX_LIMIT = 1000;
    if (limitNum > MAX_LIMIT) {
      this.logger.warn(`⚠️ Limit ${limitNum} exceeds maximum ${MAX_LIMIT}, capping to ${MAX_LIMIT}`);
      limitNum = MAX_LIMIT;
    }
    
    // Safety: Ensure limit is positive
    if (limitNum < 1) {
      limitNum = 10;
    }
    
    const skip = (pageNum - 1) * limitNum;

    this.logger.log(`📦 Finding products for tenant ${tenantId} with filters:`, filters);

    // Build where clause
    const where: any = { tenantId };
    
    // Apply category filter through junction table - only include active categories
    if (filters?.categoryId) {
      where.categories = {
        some: {
          categoryId: filters.categoryId,
          category: {
            isActive: true, // Ensure category is active
          },
        },
      };
      this.logger.log(`🔍 Filtering by categoryId: ${filters.categoryId}`);
    }
    // Note: We don't filter out products with inactive categories when no category filter is specified
    // because products might not have categories or might have multiple categories (some active, some inactive)
    // The categories relation in the include will filter to only show active categories in the response
    
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
        where: {
          category: {
            isActive: true, // Only include active categories
          },
        },
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
      // If tenant doesn't exist in database, return empty result
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        this.logger.warn(`⚠️ Tenant ${tenantId} does not exist in database. Returning empty products list.`);
        return {
          data: [],
          meta: {
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
            hasMore: false,
          },
        };
      }
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
      try {
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
      } catch (fallbackError: any) {
        // If tenant still doesn't exist, return empty result
        if (fallbackError?.code === 'P2003' || fallbackError?.message?.includes('Foreign key constraint')) {
          this.logger.warn(`⚠️ Tenant ${tenantId} does not exist in database. Returning empty products list.`);
          return {
            data: [],
            meta: {
              total: 0,
              page: pageNum,
              limit: limitNum,
              totalPages: 0,
            },
          };
        }
        throw fallbackError;
      }
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
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<ProductResponseDto> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Check if tenant exists
    const tenantExists = await this.tenantSyncService.ensureTenantExists(tenantId);
    if (!tenantExists) {
      throw new NotFoundException(`Product not found: Tenant ${tenantId} does not exist`);
    }

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

    const { variants, images, categoryIds, tags, ...productData } = updateProductDto;

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

    // Process tags: create or find ProductTag records and prepare tagItems
    let tagItemsData: Array<{ tagId: string }> = [];
    if (tags !== undefined) {
      if (tags.length > 0) {
        this.logger.log(`🏷️ Processing tags for update: ${tags.join(', ')}`);
        
        // Helper function to create slug from tag name
        const createSlug = (name: string): string => {
          return name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        };

        for (const tagName of tags) {
          if (!tagName || !tagName.trim()) continue;
          
          const tagSlug = createSlug(tagName);
          
          // Find or create ProductTag
          let productTag = await this.prisma.productTag.findUnique({
            where: {
              tenantId_slug: {
                tenantId,
                slug: tagSlug,
              },
            },
          });

          if (!productTag) {
            // Create new tag
            productTag = await this.prisma.productTag.create({
              data: {
                tenantId,
                name: tagName.trim(),
                slug: tagSlug,
              },
            });
            this.logger.log(`✅ Created new tag: ${productTag.name} (${productTag.slug})`);
          }

          tagItemsData.push({ tagId: productTag.id });
        }
      }
      // If tags is an empty array, tagItemsData will remain empty, which will clear all tags
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
          // Always update tags if provided (even if empty array to clear tags)
          ...(tags !== undefined && {
            tagItems: {
              deleteMany: {}, // Remove existing tags
              ...(tagItemsData.length > 0 && {
                create: tagItemsData,
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
          tagItems: {
            include: {
              tag: true,
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

    this.logger.log(`🗑️ Attempting to delete product: ${id} for tenant: ${tenantId}`);

    // Ensure tenant exists
    await this.tenantSyncService.ensureTenantExists(tenantId);

    // Find the product first to verify it exists and belongs to the tenant
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) {
      this.logger.warn(`⚠️ Product not found: ${id} for tenant: ${tenantId}`);
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    this.logger.log(`✅ Product found: ${product.id} - ${product.name || product.nameAr || 'Unnamed'}`);

    try {
      // Delete all related records in a transaction to avoid foreign key constraint violations
      await this.prisma.$transaction(async (tx: any) => {
        // Delete cart items first (no cascade delete)
        const cartItemsDeleted = await tx.cartItem.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${cartItemsDeleted.count} cart items`);

        // Delete order items (no cascade delete)
        const orderItemsDeleted = await tx.orderItem.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${orderItemsDeleted.count} order items`);

        // Delete product collection items (no cascade delete)
        const collectionItemsDeleted = await tx.productCollectionItem.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${collectionItemsDeleted.count} collection items`);

        // Delete product tag items (no cascade delete)
        const tagItemsDeleted = await tx.productTagItem.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${tagItemsDeleted.count} tag items`);

        // Delete product variants
        const variantsDeleted = await tx.productVariant.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${variantsDeleted.count} variants`);

        // Delete product images
        const imagesDeleted = await tx.productImage.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${imagesDeleted.count} images`);

        // Delete product-category associations
        const categoriesDeleted = await tx.productCategory.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${categoriesDeleted.count} category associations`);

        // Delete product-supplier associations
        const suppliersDeleted = await tx.productSupplier.deleteMany({
          where: { productId: id },
        });
        this.logger.log(`  Deleted ${suppliersDeleted.count} supplier associations`);

        // Finally, delete the product
        // Note: We already verified the product belongs to this tenant above
        const deletedProduct = await tx.product.delete({
          where: { id },
        });
        this.logger.log(`  Deleted product: ${deletedProduct.id}`);
      });

      // Verify the product was actually deleted
      const verifyDeleted = await this.prisma.product.findFirst({
        where: { id, tenantId },
      });

      if (verifyDeleted) {
        this.logger.error(`❌ Product still exists after deletion attempt: ${id}`);
        throw new Error(`Failed to delete product ${id} - product still exists in database`);
      }

      this.logger.log(`✅ Product deleted successfully and verified: ${id}`);
    } catch (error: any) {
      this.logger.error(`❌ Failed to delete product ${id}:`, error);
      this.logger.error(`Error details:`, {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
      });
      throw error;
    }
  }

  async bulkRemove(
    tenantId: string,
    ids: string[],
  ): Promise<{ deleted: number; failed: number; errors: string[] }> {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    if (!ids || ids.length === 0) {
      throw new BadRequestException('No product IDs provided');
    }

    // Ensure tenant exists once before starting
    await this.tenantSyncService.ensureTenantExists(tenantId);

    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process sequentially using the same logic as single delete
    for (const rawId of ids) {
      // Clean the ID similarly to previous implementation
      let cleanId = rawId.trim();
      if (cleanId.includes('/') || cleanId.includes('+')) {
        const parts = cleanId.split(/[/+]/);
        const validParts = parts.filter((part) => {
          const trimmed = part.trim();
          return (
            trimmed.length >= 20 &&
            !trimmed.includes('/') &&
            !trimmed.includes('+')
          );
        });
        if (validParts.length > 0) {
          cleanId = validParts.reduce((a, b) => (a.length > b.length ? a : b)).trim();
        }
      }

      try {
        // Reuse the robust single-delete logic
        await this.remove(tenantId, cleanId);
        deleted++;
      } catch (error: any) {
        // If the product is already gone, treat it as a soft success
        if (error instanceof NotFoundException) {
          this.logger.warn(
            `Product ${cleanId} not found during bulk delete (likely already deleted)`,
          );
          errors.push(`Product ${cleanId} not found (maybe already deleted)`);
          continue;
        }

        failed++;
        const message = error?.message || 'Unknown error';
        errors.push(`Failed to delete product ${cleanId}: ${message}`);
        this.logger.error(`Failed to delete product ${cleanId}:`, error);
      }
    }

    this.logger.log(`✅ Bulk delete completed: ${deleted} deleted, ${failed} failed`);
    return { deleted, failed, errors };
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
      coinsNumber: product.coinsNumber,
      notify: product.notify,
      min: product.min,
      max: product.max,
      webStatus: product.webStatus,
      mobileStatus: product.mobileStatus,
      purpleCardsProductNameAr: product.purpleCardsProductNameAr,
      purpleCardsProductNameEn: product.purpleCardsProductNameEn,
      purpleCardsSlugAr: product.purpleCardsSlugAr,
      purpleCardsSlugEn: product.purpleCardsSlugEn,
      purpleCardsDescAr: product.purpleCardsDescAr,
      purpleCardsDescEn: product.purpleCardsDescEn,
      purpleCardsLongDescAr: product.purpleCardsLongDescAr,
      purpleCardsLongDescEn: product.purpleCardsLongDescEn,
      purpleCardsMetaTitleAr: product.purpleCardsMetaTitleAr,
      purpleCardsMetaTitleEn: product.purpleCardsMetaTitleEn,
      purpleCardsMetaKeywordAr: product.purpleCardsMetaKeywordAr,
      purpleCardsMetaKeywordEn: product.purpleCardsMetaKeywordEn,
      purpleCardsMetaDescriptionAr: product.purpleCardsMetaDescriptionAr,
      purpleCardsMetaDescriptionEn: product.purpleCardsMetaDescriptionEn,
      ish7enProductNameAr: product.ish7enProductNameAr,
      ish7enProductNameEn: product.ish7enProductNameEn,
      ish7enSlugAr: product.ish7enSlugAr,
      ish7enSlugEn: product.ish7enSlugEn,
      ish7enDescAr: product.ish7enDescAr,
      ish7enDescEn: product.ish7enDescEn,
      ish7enLongDescAr: product.ish7enLongDescAr,
      ish7enLongDescEn: product.ish7enLongDescEn,
      ish7enMetaTitleAr: product.ish7enMetaTitleAr,
      ish7enMetaTitleEn: product.ish7enMetaTitleEn,
      ish7enMetaKeywordAr: product.ish7enMetaKeywordAr,
      ish7enMetaKeywordEn: product.ish7enMetaKeywordEn,
      ish7enMetaDescriptionAr: product.ish7enMetaDescriptionAr,
      ish7enMetaDescriptionEn: product.ish7enMetaDescriptionEn,
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