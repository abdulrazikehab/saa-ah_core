import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CardProductService } from './card-product.service';
import { CardProductController } from './card-product.controller';
import { CardInventoryService } from './card-inventory.service';
import { CardInventoryController } from './card-inventory.controller';
import { CardOrderService } from './card-order.service';
import { CardOrderController } from './card-order.controller';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    CardProductController,
    CardInventoryController,
    CardOrderController,
    WalletController,
    FavoritesController,
  ],
  providers: [
    CardProductService,
    CardInventoryService,
    CardOrderService,
    WalletService,
    FavoritesService,
  ],
  exports: [
    CardProductService,
    CardInventoryService,
    CardOrderService,
    WalletService,
    FavoritesService,
  ],
})
export class CardsModule {}

