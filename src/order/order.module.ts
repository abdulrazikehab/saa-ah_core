import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { SupplierModule } from '../supplier/supplier.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [PrismaModule, AuthModule, TenantModule, SupplierModule, CartModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}