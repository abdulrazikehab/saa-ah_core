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
    console.log('[CategoryController] getCategories called');
    console.log('[CategoryController] req.user:', req.user);
    console.log('[CategoryController] req.tenantId:', req.tenantId);
    console.log('[CategoryController] tenantIdHeader:', tenantIdHeader);
    
    const tenantId = req.tenantId || tenantIdHeader || process.env.DEFAULT_TENANT_ID || 'default';
    console.log('[CategoryController] Final tenantId used:', tenantId);

    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
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
  }

  @Post()
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

    const category = await this.prisma.category.create({
      data: {
        name: body.name,
        description: body.description,
        slug: slug,
        tenantId: tenantId,
      },
    });
    
    return { 
      message: 'Category created successfully',
      category 
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
  }

  @Patch(':id')
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

    const category = await this.prisma.category.update({
      where: { id: id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description && { description: body.description }),
        ...(body.slug && { slug: body.slug }),
      },
    });

    return { 
      message: 'Category updated successfully',
      category 
    };
  }

  @Delete(':id')
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
}