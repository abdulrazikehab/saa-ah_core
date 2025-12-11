import { Module } from '@nestjs/common';
import { SupplierInventoryService } from './supplier-inventory.service';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { SupplierManagementController } from './supplier-management.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierController, SupplierManagementController],
  providers: [SupplierInventoryService, SupplierService],
  exports: [SupplierInventoryService, SupplierService],
})
export class SupplierModule {}

