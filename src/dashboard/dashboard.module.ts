import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { SiteConfigModule } from '../site-config/site-config.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [SiteConfigModule],
  controllers: [DashboardController],
  providers: [PrismaService],
})
export class DashboardModule {}
