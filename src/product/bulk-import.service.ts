// apps/app-core/src/product/bulk-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from './product.service';
import csv from 'csv-parser';
import * as stream from 'stream';

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private prisma: PrismaService,
    private productService: ProductService,
  ) {}

  async importProductsFromCSV(tenantId: string, fileBuffer: Buffer) {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);

      bufferStream
        .pipe(csv())
        .on('data', (data:any) => results.push(data))
        .on('end', async () => {
          try {
            await this.processProducts(tenantId, results);
            resolve({ message: `Imported ${results.length} products` });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private async processProducts(tenantId: string, products: any[]) {
    for (const productData of products) {
      try {
        await this.productService.create(tenantId, {
          name: productData.name,
          description: productData.description,
          sku: productData.sku,
          price: parseFloat(productData.price),
          compareAtPrice: productData.compareAtPrice ? parseFloat(productData.compareAtPrice) : undefined,
          isAvailable: productData.isAvailable !== 'false',
        });
      } catch (error) {
        this.logger.error(`Failed to import product ${productData.name}: ${error}`);
      }
    }
  }
}