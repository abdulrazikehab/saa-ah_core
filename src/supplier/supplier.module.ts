import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SupplierInventoryService } from './supplier-inventory.service';
import { SupplierService } from './supplier.service';
import { SupplierPricingService } from './supplier-pricing.service';
import { SupplierPurchaseService } from './supplier-purchase.service';
import { SupplierController } from './supplier.controller';
import { SupplierManagementController } from './supplier-management.controller';
import { SupplierApiController } from './supplier-api.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BitaqatyBusinessService } from './integrations/bitaqaty-business.service';
import { SupplierAdapterFactory } from './integrations/supplier-adapter.factory';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [SupplierController, SupplierManagementController, SupplierApiController],
  providers: [
    SupplierInventoryService,
    SupplierService,
    SupplierPricingService,
    SupplierPurchaseService,
    BitaqatyBusinessService,
    SupplierAdapterFactory,
  ],
  exports: [
    SupplierInventoryService,
    SupplierService,
    SupplierPricingService,
    SupplierPurchaseService,
    BitaqatyBusinessService,
    SupplierAdapterFactory,
  ],
})
export class SupplierModule {}

