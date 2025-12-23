import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';
import { Public } from '../auth/public.decorator';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(private readonly productService: ProductService) {}

  private ensureTenantId(tenantId: string | undefined): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required. Please log out and log back in to refresh your session.');
    }
    return tenantId;
  }

  @Post()
  @UseGuards(TenantRequiredGuard)
  create(
    @Request() req: AuthenticatedRequest, 
    @Body() createProductDto: CreateProductDto,
    @Query('upsert') upsert?: boolean
  ) {
    try {
      // Check if user is authenticated
      if (!req.user) {
        this.logger.error('Product creation failed: User not authenticated');
        throw new ForbiddenException('Authentication required. Please log in.');
      }
      
      // TenantRequiredGuard should have already validated tenantId
      // Only use actual tenantId sources, not user.id
      const tenantId = req.user?.tenantId || req.tenantId;
      
      if (!tenantId || tenantId === 'default' || tenantId === 'system') {
        this.logger.error('Product creation failed: Invalid tenantId', {
          tenantId,
          hasUserTenantId: !!req.user?.tenantId,
          hasReqTenantId: !!req.tenantId,
          hasUserId: !!req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role
        });
        throw new ForbiddenException(
          'You must set up a market first before creating products. Please go to Market Setup to create your store, then log out and log back in to refresh your session.'
        );
      }
      
      this.logger.log(`Creating product for tenant: ${tenantId}, user: ${req.user?.email}`);
      return this.productService.create(tenantId, createProductDto, upsert);
    } catch (error: any) {
      this.logger.error('Error in product creation:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        userId: req.user?.id,
        tenantId: req.user?.tenantId || req.tenantId
      });
      
      // Re-throw known exceptions as-is
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      
      // For unknown errors, wrap in BadRequestException to prevent 500
      throw new BadRequestException(
        `Failed to create product: ${error?.message || 'Unknown error'}. Please try again or contact support if the problem persists.`
      );
    }
  }

  @Public()
  @Get()
  findAll(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('isActive') isActive?: boolean,
    @Query('market') market?: boolean,
  ) {
    // If market=true, fetch from default tenant (Master Catalog)
    // Otherwise use the authenticated user's tenant
    let targetTenantId = req.tenantId || tenantIdHeader || process.env.DEFAULT_TENANT_ID || 'default';
    
    if (market) {
      targetTenantId = 'default';
    }
    
    // Build filters object
    const filters: any = {};
    if (categoryId) filters.categoryId = categoryId;
    if (search) filters.search = search;
    if (minPrice !== undefined) filters.minPrice = Number(minPrice);
    if (maxPrice !== undefined) filters.maxPrice = Number(maxPrice);
    if (isActive !== undefined) filters.isActive = String(isActive) === 'true';
    
    return this.productService.findAll(targetTenantId, page, limit, filters);
  }

  @Public()
  @Get(':id')
  findOne(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string, 
    @Param('id') id: string
  ) {
    const tenantId = req.tenantId || tenantIdHeader || process.env.DEFAULT_TENANT_ID || 'default';
    return this.productService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(TenantRequiredGuard)
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.update(tenantId, id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(TenantRequiredGuard)
  @HttpCode(204)
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.ensureTenantId(req.tenantId);
    
    this.logger.log(`🗑️ Delete request for product: ${id}, tenant: ${tenantId}`);
    
    // Decode the id in case it was URL encoded
    let decodedId = id;
    try {
      // NestJS automatically decodes URL parameters, but we'll decode again to be safe
      decodedId = decodeURIComponent(id);
    } catch (e) {
      // If decoding fails, use original (might already be decoded)
      decodedId = id;
    }
    
    // Trim whitespace
    const cleanId = decodedId.trim();
    
    this.logger.log(`🗑️ Cleaned product ID: ${cleanId}`);
    
    await this.productService.remove(tenantId, cleanId);
    
    this.logger.log(`✅ Delete completed for product: ${cleanId}`);
    return;
  }

  @Post('bulk-delete')
  @UseGuards(TenantRequiredGuard)
  bulkDelete(@Request() req: AuthenticatedRequest, @Body() body: { ids: string[] }) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.bulkRemove(tenantId, body.ids);
  }

  @Patch('variants/:variantId/inventory')
  @UseGuards(TenantRequiredGuard)
  updateInventory(
    @Request() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body('quantity') quantity: number
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.updateInventory(tenantId, variantId, quantity);
  }
}