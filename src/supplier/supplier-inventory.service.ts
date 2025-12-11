// apps/app-core/src/supplier/supplier-inventory.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface Supplier {
  id: string;
  name: string;
  apiEndpoint?: string;
  apiKey?: string;
  syncEnabled: boolean;
}

interface InventorySyncResult {
  productId: string;
  sku: string;
  currentQuantity: number;
  supplierQuantity: number;
  synced: boolean;
  error?: string;
}

@Injectable()
export class SupplierInventoryService {
  private readonly logger = new Logger(SupplierInventoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Sync inventory for a specific product with supplier
   */
  async syncProductInventory(tenantId: string, productId: string): Promise<InventorySyncResult> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
      include: {
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get supplier information from product metadata or tenant settings
    const supplierInfo = await this.getSupplierInfo(tenantId, product.sku);
    
    if (!supplierInfo || !supplierInfo.syncEnabled) {
      this.logger.warn(`Supplier sync not enabled for product ${productId}`);
      return {
        productId,
        sku: product.sku || '',
        currentQuantity: 0,
        supplierQuantity: 0,
        synced: false,
        error: 'Supplier sync not enabled',
      };
    }

    try {
      // Fetch inventory from supplier API
      const supplierQuantity = await this.fetchSupplierInventory(supplierInfo, product.sku || '');
      
      // Update product variant inventory
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          await this.prisma.productVariant.update({
            where: { id: variant.id },
            data: {
              inventoryQuantity: supplierQuantity,
            },
          });
        }
      }

      this.logger.log(`Synced inventory for product ${productId}: ${supplierQuantity} units`);

      return {
        productId,
        sku: product.sku || '',
        currentQuantity: product.variants[0]?.inventoryQuantity || 0,
        supplierQuantity,
        synced: true,
      };
    } catch (error: any) {
      this.logger.error(`Failed to sync inventory for product ${productId}:`, error);
      return {
        productId,
        sku: product.sku || '',
        currentQuantity: product.variants[0]?.inventoryQuantity || 0,
        supplierQuantity: 0,
        synced: false,
        error: error.message || 'Sync failed',
      };
    }
  }

  /**
   * Sync all products inventory with suppliers
   */
  async syncAllInventory(tenantId: string): Promise<{ synced: number; failed: number; results: InventorySyncResult[] }> {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        isAvailable: true,
      },
      include: {
        variants: true,
      },
    });

    const results: InventorySyncResult[] = [];
    let synced = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const result = await this.syncProductInventory(tenantId, product.id);
        results.push(result);
        if (result.synced) {
          synced++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        results.push({
          productId: product.id,
          sku: product.sku || '',
          currentQuantity: 0,
          supplierQuantity: 0,
          synced: false,
          error: String(error),
        });
      }
    }

    this.logger.log(`Inventory sync completed: ${synced} synced, ${failed} failed`);

    return { synced, failed, results };
  }

  /**
   * Get supplier information from tenant settings or product metadata
   */
  private async getSupplierInfo(tenantId: string, sku?: string): Promise<Supplier | null> {
    // Check if tenant has supplier integration configured
    const integration = await this.prisma.integration.findFirst({
      where: {
        tenantId,
        type: 'SUPPLIER',
        isActive: true,
      },
    });

    if (!integration) {
      return null;
    }

    return {
      id: integration.id,
      name: integration.name,
      apiEndpoint: (integration.settings as any)?.apiEndpoint,
      apiKey: (integration.credentials as any)?.apiKey,
      syncEnabled: integration.isActive,
    };
  }

  /**
   * Fetch inventory quantity from supplier API
   */
  private async fetchSupplierInventory(supplier: Supplier, sku: string): Promise<number> {
    if (!supplier.apiEndpoint || !supplier.apiKey) {
      throw new Error('Supplier API not configured');
    }

    try {
      const response = await fetch(`${supplier.apiEndpoint}/inventory/${sku}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supplier.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Supplier API returned ${response.status}`);
      }

      const data = await response.json();
      return data.quantity || data.stock || 0;
    } catch (error: any) {
      this.logger.error(`Failed to fetch inventory from supplier ${supplier.name}:`, error);
      throw new Error(`Failed to fetch supplier inventory: ${error.message}`);
    }
  }

  /**
   * Validate inventory before order creation
   */
  async validateInventoryBeforeOrder(tenantId: string, items: Array<{ productId: string; variantId?: string; quantity: number }>): Promise<boolean> {
    for (const item of items) {
      if (item.variantId) {
        const variant = await this.prisma.productVariant.findFirst({
          where: {
            id: item.variantId,
            product: {
              tenantId,
            },
          },
        });

        if (!variant || variant.inventoryQuantity < item.quantity) {
          this.logger.warn(`Insufficient inventory for variant ${item.variantId}: requested ${item.quantity}, available ${variant?.inventoryQuantity || 0}`);
          
          // Try to sync with supplier before failing
          if (variant) {
            const product = await this.prisma.product.findFirst({
              where: { id: variant.productId },
            });
            
            if (product) {
              await this.syncProductInventory(tenantId, product.id);
              
              // Re-check after sync
              const updatedVariant = await this.prisma.productVariant.findUnique({
                where: { id: item.variantId },
              });
              
              if (!updatedVariant || updatedVariant.inventoryQuantity < item.quantity) {
                return false;
              }
            } else {
              return false;
            }
          } else {
            return false;
          }
        }
      }
    }

    return true;
  }
}

