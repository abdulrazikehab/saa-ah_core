import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SupplierPricingService } from './supplier-pricing.service';

@Injectable()
export class SupplierPurchaseService {
  private readonly logger = new Logger(SupplierPurchaseService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private pricingService: SupplierPricingService,
  ) {}

  /**
   * Purchase product from supplier
   */
  async purchaseFromSupplier(
    tenantId: string,
    productId: string,
    supplierId: string,
    quantity: number = 1,
  ) {
    try {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: supplierId, tenantId, isActive: true },
      });

      if (!supplier || !supplier.apiEndpoint) {
        throw new Error(`Supplier ${supplierId} not found or has no API endpoint`);
      }

      const productSupplier = await this.prisma.productSupplier.findFirst({
        where: { productId, supplierId },
        include: { product: true },
      });

      if (!productSupplier) {
        throw new Error(`Product ${productId} not linked to supplier ${supplierId}`);
      }

      // Get current price
      const priceInfo = await this.pricingService.fetchSupplierPrice(
        tenantId,
        productId,
        supplierId,
      );

      if (!priceInfo || !priceInfo.available) {
        throw new Error('Product not available from supplier');
      }

      // Verify price is still favorable
      const product = productSupplier.product;
      const productCost = product.costPerItem ? Number(product.costPerItem) : 0;
      const productPrice = Number(product.price);

      if (priceInfo.price <= productCost || priceInfo.price >= productPrice) {
        throw new Error(
          `Price ${priceInfo.price} is not favorable (cost: ${productCost}, selling: ${productPrice})`,
        );
      }

      // Build purchase API request
      const apiUrl = `${supplier.apiEndpoint}/purchase`;
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (supplier.apiKey) {
        headers['Authorization'] = `Bearer ${supplier.apiKey}`;
        const apiConfig = supplier.apiConfig as any;
        if (apiConfig?.authType === 'header') {
          headers[apiConfig.authHeader || 'X-API-Key'] = supplier.apiKey;
        }
      }

      const requestBody = {
        productCode: productSupplier.supplierProductCode || product.productCode || product.sku,
        quantity,
      };

      // Make purchase API call
      const response = await firstValueFrom(
        this.httpService.post(apiUrl, requestBody, { headers }),
      );

      const purchaseData = response.data;
      const unitPrice = priceInfo.price;
      const totalAmount = unitPrice * quantity;

      // Create purchase record
      const purchase = await this.prisma.supplierPurchase.create({
        data: {
          tenantId,
          productId,
          supplierId,
          quantity,
          unitPrice,
          totalAmount,
          status: 'COMPLETED',
          purchaseDate: new Date(),
        },
      });

      this.logger.log(
        `Purchased ${quantity} units of product ${productId} from supplier ${supplierId} for ${totalAmount}`,
      );

      return {
        purchase,
        purchaseData,
      };
    } catch (error) {
      this.logger.error(`Error purchasing from supplier: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-purchase from best supplier
   */
  async autoPurchaseBestSupplier(
    tenantId: string,
    productId: string,
    quantity: number = 1,
  ) {
    const bestSupplier = await this.pricingService.selectBestSupplier(tenantId, productId);

    if (!bestSupplier || !bestSupplier.shouldPurchase) {
      throw new Error(bestSupplier?.reason || 'No suitable supplier found');
    }

    return this.purchaseFromSupplier(tenantId, productId, bestSupplier.supplierId, quantity);
  }

  /**
   * Cancel purchase and request refund
   */
  async cancelPurchaseAndRefund(
    tenantId: string,
    purchaseId: string,
    reason: string,
  ) {
    try {
      const purchase = await this.prisma.supplierPurchase.findFirst({
        where: { id: purchaseId, tenantId },
        include: { supplier: true, product: true },
      });

      if (!purchase) {
        throw new Error('Purchase not found');
      }

      if (purchase.status === 'CANCELLED' || purchase.status === 'REFUNDED') {
        throw new Error('Purchase already cancelled or refunded');
      }

      const supplier = purchase.supplier;

      if (!supplier.apiEndpoint) {
        throw new Error('Supplier has no API endpoint for refund');
      }

      // Call supplier refund API
      const apiUrl = `${supplier.apiEndpoint}/refund`;
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (supplier.apiKey) {
        headers['Authorization'] = `Bearer ${supplier.apiKey}`;
        const apiConfig = supplier.apiConfig as any;
        if (apiConfig?.authType === 'header') {
          headers[apiConfig.authHeader || 'X-API-Key'] = supplier.apiKey;
        }
      }

      const requestBody = {
        purchaseId: purchase.id,
        reason,
      };

      let refundAmount = Number(purchase.totalAmount);

      try {
        const response = await firstValueFrom(
          this.httpService.post(apiUrl, requestBody, { headers }),
        );
        refundAmount = response.data.refundAmount
          ? Number(response.data.refundAmount)
          : refundAmount;
      } catch (error) {
        this.logger.warn(`Refund API call failed, marking as cancelled: ${error.message}`);
      }

      // Update purchase record
      const updatedPurchase = await this.prisma.supplierPurchase.update({
        where: { id: purchaseId },
        data: {
          status: refundAmount > 0 ? 'REFUNDED' : 'CANCELLED',
          cancelledAt: new Date(),
          refundedAt: refundAmount > 0 ? new Date() : null,
          refundAmount: refundAmount > 0 ? refundAmount : null,
          reason,
        },
      });

      this.logger.log(
        `Purchase ${purchaseId} cancelled/refunded. Amount: ${refundAmount}`,
      );

      return updatedPurchase;
    } catch (error) {
      this.logger.error(`Error cancelling purchase: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor active purchases and stop if price becomes unfavorable
   */
  async monitorActivePurchases(tenantId: string) {
    const activePurchases = await this.prisma.supplierPurchase.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        supplier: {
          autoPurchaseEnabled: true,
        },
      },
      include: {
        supplier: true,
        product: true,
      },
    });

    const results = [];

    for (const purchase of activePurchases) {
      try {
        const shouldStop = await this.pricingService.shouldStopPurchase(
          tenantId,
          purchase.productId,
          purchase.supplierId,
        );

        if (shouldStop.shouldStop) {
          await this.cancelPurchaseAndRefund(
            tenantId,
            purchase.id,
            shouldStop.reason,
          );
          results.push({
            purchaseId: purchase.id,
            action: 'stopped',
            reason: shouldStop.reason,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error monitoring purchase ${purchase.id}: ${error.message}`,
        );
        results.push({
          purchaseId: purchase.id,
          action: 'error',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get all purchases for a tenant
   */
  async getPurchases(tenantId: string) {
    try {
      if (!tenantId) {
        throw new BadRequestException('Tenant ID is required');
      }
      
      this.logger.debug(`Fetching purchases for tenant: ${tenantId}`);
      
      const purchases = await this.prisma.supplierPurchase.findMany({
        where: { tenantId },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
      });

      this.logger.debug(`Found ${purchases.length} purchases for tenant ${tenantId}`);
      return purchases || [];
    } catch (error: any) {
      this.logger.error(`Error fetching purchases for tenant ${tenantId}:`, error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      // If it's a Prisma error, provide more context
      if (error?.code) {
        this.logger.error(`Prisma error code: ${error.code}`, error);
      }
      throw new BadRequestException(
        `Failed to fetch purchases: ${error?.message || 'Unknown error'}`
      );
    }
  }
}

