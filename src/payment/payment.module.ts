import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentSettingsService } from './payment-settings.service';
import { HyperPayService } from './hyperpay.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentSettingsService, HyperPayService, PrismaService],
  exports: [PaymentSettingsService, HyperPayService],
})
export class PaymentModule {}