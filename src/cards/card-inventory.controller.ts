import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CardInventoryService, ImportCardDto } from './card-inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';

@Controller('card-inventory')
@UseGuards(JwtAuthGuard, TenantRequiredGuard)
export class CardInventoryController {
  constructor(private readonly cardInventoryService: CardInventoryService) {}

  @Post('import/:productId')
  @UseInterceptors(FileInterceptor('file'))
  async importFromExcel(
    @Request() req: any,
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    return this.cardInventoryService.importFromExcel(
      req.tenantId,
      productId,
      file.buffer,
      file.originalname,
      req.user.userId,
    );
  }

  @Post('import-manual/:productId')
  async importManual(
    @Request() req: any,
    @Param('productId') productId: string,
    @Body() body: { cards: ImportCardDto[] },
  ) {
    return this.cardInventoryService.importFromArray(
      req.tenantId,
      productId,
      body.cards,
      req.user.userId,
    );
  }

  @Get(':productId')
  async getInventory(
    @Request() req: any,
    @Param('productId') productId: string,
    @Query('status') status?: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'EXPIRED' | 'INVALID' | 'REFUNDED',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.cardInventoryService.getInventory(
      req.tenantId,
      productId,
      status,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('batches')
  async getBatches(
    @Request() req: any,
    @Query('productId') productId?: string,
  ) {
    return this.cardInventoryService.getBatches(req.tenantId, productId);
  }

  @Get('my-cards')
  async getMyCards(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.cardInventoryService.getUserPurchasedCards(
      req.user.userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Delete(':cardId')
  async deleteCard(@Request() req: any, @Param('cardId') cardId: string) {
    return this.cardInventoryService.deleteCard(req.tenantId, cardId);
  }

  @Post('expire-check')
  async checkExpiredCards(@Request() req: any) {
    const count = await this.cardInventoryService.markExpiredCards(req.tenantId);
    return { expiredCount: count };
  }
}

