import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SiteConfigController } from './site-config.controller';
import { SiteConfigService } from './site-config.service';
import { PrismaService } from '../prisma/prisma.service';

import { PageModule } from '../page/page.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PageModule, PaymentModule, HttpModule],
  controllers: [SiteConfigController],
  providers: [SiteConfigService, PrismaService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
