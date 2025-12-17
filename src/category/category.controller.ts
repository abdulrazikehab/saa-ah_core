import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards, 
  Request,
  Headers,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';
import { Public } from '../auth/public.decorator';
import { AuthenticatedRequest } from '../types/request.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private prisma: PrismaService) {}

  private ensureTenantId(tenantId: string | undefined): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required. Please log out and log back in to refresh your session.');
    }
    return tenantId;
  }

  @Public()
  @Get()
  async getCategories(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string
  ) {
    try {
      const tenantId = req.tenantId || tenantIdHeader || process.env.DEFAULT_TENANT_ID || 'default';

      const categories = await this.prisma.category.findMany({
        where: { 
          tenantId,
          isActive: true // Only return active categories
        },
        select: {
          id: true,
          name: true,
          nameAr: true,
          slug: true,
          description: true,
          descriptionAr: true,
          image: true,
          createdAt: true,
          updatedAt: true,
          parentId: true,
          isActive: true,
          _count: {
            select: { products: true }
          }
        },
        orderBy: { name: 'asc' },
      });
      
      // Map to include productCount for frontend
      const mappedCategories = categories.map((c: any) => ({
        ...c,
        productCount: c._count.products
      }));
      
      return { categories: mappedCategories };
    } catch (error: any) {
      console.error('Error in getCategories:', error);
      
      // If tenant doesn't exist, return empty array
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return { categories: [] };
      }
      
      // If parentId column doesn't exist, try without it
      if (error.message?.includes('parentId') || error.code === 'P2001') {
        const tenantId = req.tenantId || tenantIdHeader || process.env.DEFAULT_TENANT_ID || 'default';
        try {
          const categories = await this.prisma.category.findMany({
            where: { 
              tenantId,
              isActive: true // Only return active categories
            },
            select: {
              id: true,
              name: true,
              nameAr: true,
              slug: true,
              description: true,
              descriptionAr: true,
              image: true,
              createdAt: true,
              updatedAt: true,
              isActive: true,
              _count: {
                select: { products: true }
              }
            },
            orderBy: { name: 'asc' },
          });
          
          const mappedCategories = categories.map((c: any) => ({
            ...c,
            productCount: c._count.products,
            parentId: null
          }));
          
          return { categories: mappedCategories };
        } catch (fallbackError: any) {
          // If tenant still doesn't exist, return empty array
          if (fallbackError?.code === 'P2003' || fallbackError?.message?.includes('Foreign key constraint')) {
            return { categories: [] };
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  @Post()
  @UseGuards(TenantRequiredGuard)
  async createCategory(
    @Request() req: AuthenticatedRequest,
    @Body() body: CreateCategoryDto,
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check if slug already exists for this tenant
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        tenantId: tenantId,
        slug: slug,
      },
    });

    if (existingCategory) {
      throw new BadRequestException('Category with this slug already exists');
    }

    // Validate parentId if provided
    if (body.parentId) {
      const parentCategory = await this.prisma.category.findFirst({
        where: {
          id: body.parentId,
          tenantId: tenantId,
        },
      });

      if (!parentCategory) {
        throw new BadRequestException('Parent category not found');
      }
    }

    // Try to create category with all fields
    try {
      const category = await this.prisma.category.create({
        data: {
          name: body.name,
          nameAr: body.nameAr,
          description: body.description,
          descriptionAr: body.descriptionAr,
          slug: slug,
          tenantId: tenantId,
          image: body.image,
          icon: body.icon,
          parentId: body.parentId || null,
          isActive: body.isActive !== undefined ? body.isActive : true,
          sortOrder: body.sortOrder || 0,
        },
      });
      
      return { 
        message: 'Category created successfully',
        category 
      };
    } catch (error: any) {
      // If some columns don't exist, try with minimal fields
      if (error.message?.includes('Unknown column') || error.code === 'P2009') {
        const category = await this.prisma.category.create({
          data: {
            name: body.name,
            nameAr: body.nameAr,
            description: body.description,
            descriptionAr: body.descriptionAr,
            slug: slug,
            tenantId: tenantId,
            image: body.image,
            icon: body.icon,
            parentId: body.parentId || null,
            isActive: body.isActive !== undefined ? body.isActive : true,
            sortOrder: body.sortOrder || 0,
          } as any, // Use 'as any' to bypass TypeScript if some fields don't exist in schema
        });
        
        return { 
          message: 'Category created successfully',
          category 
        };
      }
      throw error;
    }
    
    return { 
      message: 'Category created successfully',
      category: category
    };
  }

  @Public()
  @Get(':id')
  async getCategory(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId || tenantIdHeader || process.env.DEFAULT_TENANT_ID || 'default';
    try {
      const category = await this.prisma.category.findFirst({
        where: {
          id: id,
          tenantId,
        },
      });

      if (!category) {
        throw new BadRequestException('Category not found');
      }

      return { category };
    } catch (error: any) {
      // If tenant doesn't exist, throw not found
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        throw new BadRequestException('Category not found: Tenant does not exist');
      }
      throw error;
    }
  }

  @Patch(':id')
  @UseGuards(TenantRequiredGuard)
  async updateCategory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    
    // Verify category exists and belongs to tenant
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        id: id,
        tenantId: tenantId,
      },
    });

    if (!existingCategory) {
      throw new BadRequestException('Category not found');
    }

    // Validate parentId if provided
    if (body.parentId !== undefined) {
      if (body.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      
      if (body.parentId) {
        const parentCategory = await this.prisma.category.findFirst({
          where: {
            id: body.parentId,
            tenantId: tenantId,
          },
        });

        if (!parentCategory) {
          throw new BadRequestException('Parent category not found');
        }
      }
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.nameAr !== undefined) updateData.nameAr = body.nameAr;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.descriptionAr !== undefined) updateData.descriptionAr = body.descriptionAr;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.image !== undefined) updateData.image = body.image;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.parentId !== undefined) updateData.parentId = body.parentId || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const category = await this.prisma.category.update({
      where: { id: id },
      data: updateData,
    });

    return { 
      message: 'Category updated successfully',
      category 
    };
  }

  @Delete(':id')
  @UseGuards(TenantRequiredGuard)
  async deleteCategory(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    
    // Verify category exists and belongs to tenant
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        id: id,
        tenantId: tenantId,
      },
    });

    if (!existingCategory) {
      throw new BadRequestException('Category not found');
    }

    // Check if category has products
    const productsWithCategory = await this.prisma.productCategory.count({
      where: {
        categoryId: id,
      },
    });

    if (productsWithCategory > 0) {
      throw new BadRequestException('Cannot delete category that has products. Remove products first.');
    }

    await this.prisma.category.delete({
      where: { id: id },
    });

    return { message: 'Category deleted successfully' };
  }

  @Post('bulk-delete')
  @UseGuards(TenantRequiredGuard)
  async bulkDeleteCategories(
    @Request() req: AuthenticatedRequest,
    @Body() body: { ids: string[] },
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    
    if (!body.ids || body.ids.length === 0) {
      throw new BadRequestException('No category IDs provided');
    }

    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const id of body.ids) {
      try {
        // Verify category exists and belongs to tenant
        const existingCategory = await this.prisma.category.findFirst({
          where: {
            id: id,
            tenantId: tenantId,
          },
        });

        if (!existingCategory) {
          failed++;
          errors.push(`Category ${id} not found`);
          continue;
        }

        // Check if category has products
        const productsWithCategory = await this.prisma.productCategory.count({
          where: {
            categoryId: id,
          },
        });

        if (productsWithCategory > 0) {
          failed++;
          errors.push(`Category ${existingCategory.name} has products and cannot be deleted`);
          continue;
        }

        await this.prisma.category.delete({
          where: { id: id },
        });

        deleted++;
      } catch (error: any) {
        failed++;
        errors.push(`Failed to delete category ${id}: ${error.message}`);
      }
    }

    return {
      message: `Bulk delete completed: ${deleted} deleted, ${failed} failed`,
      deleted,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}