import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';
import { SupplierPricingService } from './supplier-pricing.service';
import { SupplierPurchaseService } from './supplier-purchase.service';

@UseGuards(JwtAuthGuard)
@Controller('supplier-api')
export class SupplierApiController {
  constructor(
    private readonly pricingService: SupplierPricingService,
    private readonly purchaseService: SupplierPurchaseService,
  ) {}

  /**
   * Get price from a specific supplier
   */
  @Get('price/:productId/:supplierId')
  async getSupplierPrice(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('supplierId') supplierId: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.pricingService.fetchSupplierPrice(tenantId, productId, supplierId);
  }

  /**
   * Get prices from all suppliers for a product
   */
  @Get('prices/:productId')
  async getAllSupplierPrices(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.pricingService.fetchAllSupplierPrices(tenantId, productId);
  }

  /**
   * Select best supplier for a product
   */
  @Get('best/:productId')
  async getBestSupplier(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.pricingService.selectBestSupplier(tenantId, productId);
  }

  /**
   * Purchase from a specific supplier
   */
  @Post('purchase/:productId/:supplierId')
  async purchaseFromSupplier(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('supplierId') supplierId: string,
    @Body() body: { quantity?: number },
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.purchaseService.purchaseFromSupplier(
      tenantId,
      productId,
      supplierId,
      body.quantity || 1,
    );
  }

  /**
   * Auto-purchase from best supplier
   */
  @Post('auto-purchase/:productId')
  async autoPurchase(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Body() body: { quantity?: number },
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.purchaseService.autoPurchaseBestSupplier(
      tenantId,
      productId,
      body.quantity || 1,
    );
  }

  /**
   * Cancel purchase and request refund
   */
  @Post('cancel/:purchaseId')
  async cancelPurchase(
    @Request() req: AuthenticatedRequest,
    @Param('purchaseId') purchaseId: string,
    @Body() body: { reason: string },
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.purchaseService.cancelPurchaseAndRefund(
      tenantId,
      purchaseId,
      body.reason,
    );
  }

  /**
   * Monitor active purchases (check prices and stop if unfavorable)
   */
  @Post('monitor')
  async monitorPurchases(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.purchaseService.monitorActivePurchases(tenantId);
  }

  /**
   * Check if should stop purchasing from supplier
   */
  @Get('should-stop/:productId/:supplierId')
  async shouldStopPurchase(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
    @Param('supplierId') supplierId: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.id;
    return this.pricingService.shouldStopPurchase(tenantId, productId, supplierId);
  }

  /**
   * Get all purchases for the tenant
   */
  @Get('purchases')
  async getPurchases(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    try {
      return await this.purchaseService.getPurchases(tenantId);
    } catch (error: any) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  }
}

