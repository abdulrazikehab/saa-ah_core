import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CardProductService } from '../../cards/card-product.service';
import { MerchantService } from '../services/merchant.service';
import { PriceAlertService } from '../services/price-alert.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../../guard/tenant-required.guard';

@Controller('merchant/products')
@UseGuards(JwtAuthGuard, TenantRequiredGuard)
export class MerchantProductController {
  constructor(
    private readonly productService: CardProductService,
    private readonly merchantService: MerchantService,
    private readonly priceAlertService: PriceAlertService,
  ) {}

  @Get('categories')
  async getCategories(@Request() req: any) {
    const tenantId = req.tenantId;
    return this.productService.getCategoriesWithProducts(tenantId);
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('q') q?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const tenantId = req.tenantId;

    const products = await this.productService.findAll(
      tenantId,
      {
        categoryId,
        brandId,
        search: q,
        isActive: true,
      },
      parseInt(page),
      parseInt(limit),
    );

    return products;
  }

  @Get(':id')
  async findOne(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId;

    const product = await this.productService.findOne(tenantId, id);

    return {
      id: product.id,
      name: product.name,
      nameAr: product.nameAr,
      description: product.description,
      descriptionAr: product.descriptionAr,
      image: product.image,
      denomination: Number(product.denomination),
      currency: product.currency,
      wholesalePrice: Number(product.wholesalePrice),
      retailPrice: Number(product.retailPrice),
      profitMargin: Number(product.profitMargin),
      taxRate: Number(product.taxRate),
      minQuantity: product.minQuantity,
      maxQuantity: product.maxQuantity,
      isActive: product.isActive,
      isAvailable: product.isAvailable,
      availableStock: product.availableStock,
      brand: product.brand ? {
        id: product.brand.id,
        name: product.brand.name,
        nameAr: product.brand.nameAr,
        logo: product.brand.logo,
      } : null,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        nameAr: product.category.nameAr,
      } : null,
    };
  }

  @Get(':id/price-history')
  async getPriceHistory(
    @Request() req: any,
    @Param('id') id: string,
    @Query('limit') limit: string = '30',
  ) {
    const userId = req.user.id || req.user.userId;
    const context = await this.merchantService.validateMerchantAccess(userId, 'reportsRead');

    return this.priceAlertService.getPriceHistory(id, parseInt(limit));
  }
}

