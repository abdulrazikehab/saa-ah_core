import { Module } from '@nestjs/common';
import { PurchaseLimitsController } from './purchase-limits.controller';
import { PurchaseLimitsService } from './purchase-limits.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PurchaseLimitsController],
  providers: [PurchaseLimitsService, PrismaService],
  exports: [PurchaseLimitsService],
})
export class PurchaseLimitsModule {}
