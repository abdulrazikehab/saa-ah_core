import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async overview(tenantId: string) {
    const totalOrders = await this.prisma.order.count({
      where: { tenantId, paymentStatus: 'SUCCEEDED' },
    });
    const revenue = await this.prisma.order.aggregate({
      where: { tenantId, paymentStatus: 'SUCCEEDED' },
      _sum: { totalAmount: true },
    });
    // Access transaction model via getter in PrismaService
    const totalTransactions = await this.prisma.transaction.count({
      where: { tenantId, status: 'COMPLETED' },
    });
    const activity = await this.prisma.activityLog.count({
      where: { tenantId },
    });
    return {
      totalOrders,
      revenue: Number(revenue._sum.totalAmount ?? 0),
      totalTransactions,
      activityCount: activity,
    };
  }

  async getProductReport(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { orderItems: true }
        },
        orderItems: {
          select: {
            quantity: true,
            price: true
          }
        },
        variants: {
          select: {
            inventoryQuantity: true
          }
        }
      }
    });

    return products.map((p: any) => {
      // Calculate total stock from variants (inventoryQuantity field)
      const totalStock = p.variants?.reduce((sum: number, v: any) => sum + (Number(v.inventoryQuantity || 0)), 0) || 0;
      
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: totalStock,
        salesCount: p.orderItems.reduce((acc: number, item: any) => acc + item.quantity, 0),
        revenue: p.orderItems.reduce((acc: number, item: any) => acc + (Number(item.price) * item.quantity), 0)
      };
    }).sort((a: any, b: any) => b.revenue - a.revenue);
  }

  async getCustomerReport(tenantId: string) {
    const customers = await this.prisma.order.groupBy({
      by: ['customerEmail', 'customerName'],
      where: { tenantId, paymentStatus: 'SUCCEEDED' },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    return customers.map((c: any) => ({
      email: c.customerEmail,
      name: c.customerName || 'Unknown',
      orders: c._count.id,
      totalSpent: Number(c._sum.totalAmount ?? 0)
    })).sort((a: any, b: any) => b.totalSpent - a.totalSpent);
  }

  async getPaymentReport(tenantId: string) {
    const payments = await this.prisma.transaction.groupBy({
      by: ['paymentProvider'],
      where: { tenantId, status: 'COMPLETED' },
      _count: { id: true },
      _sum: { amount: true, platformFee: true, merchantEarnings: true },
    });

    return payments.map((p: any) => ({
      provider: p.paymentProvider,
      transactions: p._count.id,
      volume: Number(p._sum.amount ?? 0),
      fees: Number(p._sum.platformFee ?? 0),
      net: Number(p._sum.merchantEarnings ?? 0)
    }));
  }
}
