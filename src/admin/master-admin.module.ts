import { Module } from '@nestjs/common';
import { MasterAdminController } from './master-admin.controller';
import { MasterAdminService } from './master-admin.service';
import { PrismaModule } from '../prisma/prisma.module';

import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [MasterAdminController],
  providers: [MasterAdminService],
  exports: [MasterAdminService],
})
export class MasterAdminModule {}
