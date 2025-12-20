// Factory to create supplier adapters based on supplier type
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupplierAdapter } from './supplier-adapter.interface';
import { BitaqatyBusinessService } from './bitaqaty-business.service';
import { BitaqatyAdapter } from './bitaqaty-adapter';
import { Supplier } from '@prisma/client';

export interface SupplierConfig {
  resellerUsername?: string;
  secretKey?: string;
  environment?: 'staging' | 'production';
  merchantId?: string;
  [key: string]: any; // Allow additional config fields
}

@Injectable()
export class SupplierAdapterFactory {
  private readonly logger = new Logger(SupplierAdapterFactory.name);

  constructor(private bitaqatyService: BitaqatyBusinessService) {}

  /**
   * Create supplier adapter based on supplier type
   */
  createAdapter(supplier: Supplier): SupplierAdapter {
    const apiConfig = (supplier.apiConfig || {}) as SupplierConfig;

    switch (supplier.supplierType) {
      case 'BITAQATY_BUSINESS':
        if (!apiConfig.resellerUsername || !apiConfig.secretKey) {
          throw new BadRequestException(
            'Bitaqaty Business requires resellerUsername and secretKey in apiConfig'
          );
        }

        return new BitaqatyAdapter(this.bitaqatyService, {
          resellerUsername: apiConfig.resellerUsername,
          secretKey: apiConfig.secretKey,
          environment: apiConfig.environment || 'staging',
          merchantId: apiConfig.merchantId,
        });

      case 'CUSTOM':
      default:
        // For custom suppliers, you can create a generic HTTP adapter
        // or throw an error if not implemented
        throw new BadRequestException(
          `Custom supplier adapter not yet implemented. Please use a supported supplier type.`
        );
    }
  }

  /**
   * Check if supplier type is supported
   */
  isSupported(supplierType: string): boolean {
    return ['BITAQATY_BUSINESS', 'CUSTOM'].includes(supplierType);
  }
}

