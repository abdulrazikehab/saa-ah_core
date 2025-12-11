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
  Headers
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  private ensureTenantId(tenantId: string | undefined): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required. Please log out and log back in to refresh your session.');
    }
    return tenantId;
  }

  @Post()
  create(
    @Request() req: AuthenticatedRequest, 
    @Body() createProductDto: CreateProductDto,
    @Query('upsert') upsert?: boolean
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.create(tenantId, createProductDto, upsert);
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
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.update(tenantId, id, updateProductDto);
  }

  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.remove(tenantId, id);
  }

  @Patch('variants/:variantId/inventory')
  updateInventory(
    @Request() req: AuthenticatedRequest,
    @Param('variantId') variantId: string,
    @Body('quantity') quantity: number
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.productService.updateInventory(tenantId, variantId, quantity);
  }
}