import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardInventoryService } from '../cards/card-inventory.service';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface DigitalCardDeliveryResult {
  excelFileUrl: string;
  textFileUrl: string;
  serialNumbers: string[];
}

@Injectable()
export class DigitalCardsDeliveryService {
  private readonly logger = new Logger(DigitalCardsDeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private cardInventoryService: CardInventoryService,
  ) {}

  /**
   * Process digital cards delivery for an order
   * Reserves cards, marks them as sold, and generates delivery files
   */
  async processDigitalCardsDelivery(
    tenantId: string,
    orderId: string,
    userId: string | null,
    orderItems: Array<{ productId: string; quantity: number; productName: string }>,
  ): Promise<DigitalCardDeliveryResult | null> {
    // Check if tenant is a digital cards store
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { storeType: true },
    });

    if (tenant?.storeType !== 'DIGITAL_CARDS') {
      return null; // Not a digital cards store, skip processing
    }

    this.logger.log(`Processing digital cards delivery for order ${orderId}`);

    const allSerialNumbers: Array<{ productName: string; serialNumber: string; pin?: string }> = [];

    // Process each order item
    for (const item of orderItems) {
      // Check if product exists and is a card product
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });

      if (!product) {
        this.logger.warn(`Product ${item.productId} not found, skipping`);
        continue;
      }

      // Check if product has cards in inventory
      const availableCards = await this.prisma.cardInventory.count({
        where: {
          productId: item.productId,
          status: 'AVAILABLE',
          OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
        },
      });

      if (availableCards < item.quantity) {
        this.logger.error(`Insufficient cards in inventory for product ${item.productId}: requested ${item.quantity}, available ${availableCards}`);
        throw new BadRequestException(
          `لا توجد بطاقات كافية في المخزون للمنتج ${item.productName}. المتاح: ${availableCards}, المطلوب: ${item.quantity}`
        );
      }

      // Reserve cards from inventory
      try {
        this.logger.log(`Reserving ${item.quantity} cards for product ${item.productId} (${item.productName})`);
        const cardIds = await this.cardInventoryService.reserveCards(
          item.productId,
          item.quantity,
          orderId,
        );

        if (!cardIds || cardIds.length === 0) {
          throw new BadRequestException(`Failed to reserve cards for ${item.productName}`);
        }

        this.logger.log(`Reserved ${cardIds.length} cards for product ${item.productId}`);

        // Get the reserved cards
        const cards = await this.prisma.cardInventory.findMany({
          where: { id: { in: cardIds } },
        });

        // Mark cards as sold
        if (userId) {
          await this.cardInventoryService.markAsSold(cardIds, userId, orderId);
        } else {
          // For guest orders, mark as sold without userId
          await this.prisma.cardInventory.updateMany({
            where: { id: { in: cardIds } },
            data: {
              status: 'SOLD',
              soldAt: new Date(),
              orderId,
            },
          });
        }

        // Collect serial numbers
        for (const card of cards) {
          allSerialNumbers.push({
            productName: item.productName,
            serialNumber: card.cardCode,
            pin: card.cardPin || undefined,
          });
        }

        this.logger.log(`Reserved and marked ${cards.length} cards for product ${item.productName}`);
      } catch (error: any) {
        this.logger.error(`Failed to reserve cards for product ${item.productId}:`, error);
        throw new BadRequestException(
          `Failed to reserve cards for ${item.productName}: ${error.message}`,
        );
      }
    }

    if (allSerialNumbers.length === 0) {
      this.logger.warn(`No cards to deliver for order ${orderId}`);
      return null;
    }

    // Generate delivery files
    const files = await this.generateDeliveryFiles(
      tenantId,
      orderId,
      allSerialNumbers,
    );

    this.logger.log(`Generated delivery files for order ${orderId}: ${allSerialNumbers.length} cards`);

    return {
      excelFileUrl: files.excelPath,
      textFileUrl: files.textPath,
      serialNumbers: allSerialNumbers.map(c => c.serialNumber),
    };
  }

  /**
   * Generate Excel and text files with serial numbers
   */
  private async generateDeliveryFiles(
    tenantId: string,
    orderId: string,
    serialNumbers: Array<{ productName: string; serialNumber: string; pin?: string }>,
  ): Promise<{ excelPath: string; textPath: string }> {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'digital-cards', tenantId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const excelFileName = `order-${orderId}-${timestamp}.xlsx`;
    const textFileName = `order-${orderId}-${timestamp}.txt`;
    const excelPath = path.join(uploadsDir, excelFileName);
    const textPath = path.join(uploadsDir, textFileName);

    // Generate Excel file
    const workbook = xlsx.utils.book_new();
    const worksheetData = [
      ['Product Name', 'Serial Number', 'PIN'],
      ...serialNumbers.map(card => [
        card.productName,
        card.serialNumber,
        card.pin || '',
      ]),
    ];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Serial Numbers');
    xlsx.writeFile(workbook, excelPath);

    // Generate text file
    const textContent = serialNumbers
      .map((card, index) => {
        let line = `${index + 1}. ${card.productName}\n`;
        line += `   Serial Number: ${card.serialNumber}\n`;
        if (card.pin) {
          line += `   PIN: ${card.pin}\n`;
        }
        return line;
      })
      .join('\n');

    fs.writeFileSync(textPath, textContent, 'utf-8');

    // Return relative paths for API access
    return {
      excelPath: `/uploads/digital-cards/${tenantId}/${excelFileName}`,
      textPath: `/uploads/digital-cards/${tenantId}/${textFileName}`,
    };
  }

  /**
   * Get delivery files for an order
   */
  async getDeliveryFiles(orderId: string): Promise<{ excelFileUrl?: string; textFileUrl?: string } | null> {
    // Check if order has associated cards
    const cards = await this.prisma.cardInventory.findMany({
      where: { orderId, status: 'SOLD' },
      take: 1,
    });

    if (cards.length === 0) {
      return null;
    }

    // Find files in uploads directory
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { tenantId: true },
    });

    if (!order) {
      return null;
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'digital-cards', order.tenantId);
    const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith(`order-${orderId}-`));

    const excelFile = files.find(f => f.endsWith('.xlsx'));
    const textFile = files.find(f => f.endsWith('.txt'));

    return {
      excelFileUrl: excelFile ? `/uploads/digital-cards/${order.tenantId}/${excelFile}` : undefined,
      textFileUrl: textFile ? `/uploads/digital-cards/${order.tenantId}/${textFile}` : undefined,
    };
  }
}

