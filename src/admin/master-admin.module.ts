import { Module } from '@nestjs/common';
import { MasterAdminController } from './master-admin.controller';
import { MasterAdminService } from './master-admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { AdminApiKeyGuard } from '../guard/admin-api-key.guard';

import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({}),
    ApiKeyModule,
  ],
  controllers: [MasterAdminController],
  providers: [MasterAdminService, AdminApiKeyGuard],
  exports: [MasterAdminService],
})
export class MasterAdminModule {}
