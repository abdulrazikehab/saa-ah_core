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
      // TenantRequiredGuard should have already validated tenantId
      // Only use actual tenantId sources, not user.id
      const tenantId = req.user?.tenantId || req.tenantId;
      
      if (!tenantId || tenantId === 'default' || tenantId === 'system') {
        this.logger.error('Product creation failed: Invalid tenantId', {
          tenantId,
          hasUserTenantId: !!req.user?.tenantId,
          hasReqTenantId: !!req.tenantId,
          hasUserId: !!req.user?.id,
          user: req.user
        });
        throw new ForbiddenException(
          'You must set up a market first before creating products. Please go to Market Setup to create your store.'
        );
      }
      
      this.logger.log(`Creating product for tenant: ${tenantId}`);
      return this.productService.create(tenantId, createProductDto, upsert);
    } catch (error: any) {
      this.logger.error('Error in product creation:', error);
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      // Log the full error for debugging
      this.logger.error('Product creation error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      throw new BadRequestException(`Failed to create product: ${error?.message || 'Unknown error'}`);
    }
  }

  @Public()
  @Get()
  findAll(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
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
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.ensureTenantId(req.tenantId);
    
    // Decode the id in case it was URL encoded
    let decodedId = id;
    try {
      decodedId = decodeURIComponent(id);
    } catch (e) {
      // If decoding fails, use original
    }
    
    // Clean the ID - remove any URL encoding artifacts or extra characters
    let cleanId = decodedId.trim();
    
    // If ID contains slashes or plus signs, try to extract the actual ID
    if (cleanId.includes('/') || cleanId.includes('+')) {
      const parts = cleanId.split(/[/+]/);
      const validParts = parts.filter(part => {
        const trimmed = part.trim();
        return trimmed.length >= 20 && !trimmed.includes('/') && !trimmed.includes('+');
      });
      if (validParts.length > 0) {
        cleanId = validParts.reduce((a, b) => a.length > b.length ? a : b).trim();
      }
    }
    
    return this.productService.remove(tenantId, cleanId);
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