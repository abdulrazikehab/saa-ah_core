import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderStats(tenantId: string) {
    const totalOrders = await this.prisma.order.count({
      where: { tenantId },
    });

    const revenue = await this.prisma.order.aggregate({
      where: { 
        tenantId,
        paymentStatus: 'SUCCEEDED'
      },
      _sum: {
        totalAmount: true,
      },
    });

    const pendingOrders = await this.prisma.order.count({
      where: { tenantId, status: 'PENDING' },
    });

    return {
      totalOrders,
      totalRevenue: Number(revenue._sum.totalAmount) || 0,
      pendingOrders,
    };
  }

  async getProductStats(tenantId: string) {
    const totalProducts = await this.prisma.product.count({
      where: { tenantId },
    });

    const lowStockProducts = await this.prisma.productVariant.count({
      where: { 
        product: { tenantId },
        trackInventory: true,
        inventoryQuantity: { lte: 5 }
      }
    });

    return {
      totalProducts,
      lowStockProducts,
    };
  }

  async getDashboardStats(tenantId: string) {
    const [orderStats, productStats] = await Promise.all([
      this.getOrderStats(tenantId),
      this.getProductStats(tenantId),
    ]);

    return {
      ...orderStats,
      ...productStats,
    };
  }

  async getTrafficStats(tenantId: string) {
    // Placeholder for now as we don't track page views in DB yet
    // Could be implemented with Redis or a separate analytics table
    return { visits: 0, uniqueVisitors: 0 };
  }
}
