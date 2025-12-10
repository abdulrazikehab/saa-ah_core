import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CategoryController],
})
export class CategoryModule {}