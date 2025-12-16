import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getDefaultCurrency } from '../common/utils/currency.util';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async overview(tenantId: string) {
    if (!tenantId) {
      return { totalOrders: 0, revenue: 0, totalTransactions: 0, activityCount: 0 };
    }
    try {
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
    } catch (error: any) {
      // If tenant doesn't exist, return empty stats
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return { totalOrders: 0, revenue: 0, totalTransactions: 0, activityCount: 0 };
      }
      throw error;
    }
  }

  async getProductReport(tenantId: string) {
    if (!tenantId) {
      return [];
    }
    try {
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
    } catch (error: any) {
      // If tenant doesn't exist, return empty array
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return [];
      }
      throw error;
    }
  }

  async getCustomerReport(tenantId: string) {
    if (!tenantId) {
      return [];
    }
    try {
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
    } catch (error: any) {
      // If tenant doesn't exist, return empty array
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return [];
      }
      throw error;
    }
  }

  async getPaymentReport(tenantId: string) {
    if (!tenantId) {
      return [];
    }
    try {
      // Get default currency for the tenant
      const defaultCurrency = await getDefaultCurrency(this.prisma, tenantId);
      
      const payments = await this.prisma.transaction.groupBy({
        by: ['paymentProvider'],
        where: { tenantId, status: 'COMPLETED' },
        _count: { id: true },
        _sum: { amount: true, platformFee: true, merchantEarnings: true },
      });

      // Get unique currencies used in transactions for this tenant
      const currencyData = await this.prisma.transaction.findMany({
        where: { tenantId, status: 'COMPLETED' },
        select: { currency: true },
        distinct: ['currency'],
      });
      const currenciesUsed = currencyData.map((t: any) => t.currency || defaultCurrency).filter(Boolean);

      return payments.map((p: any) => ({
        provider: p.paymentProvider,
        transactions: p._count.id,
        volume: Number(p._sum.amount ?? 0),
        fees: Number(p._sum.platformFee ?? 0),
        net: Number(p._sum.merchantEarnings ?? 0),
        currency: defaultCurrency, // Default currency for the report
        currenciesUsed, // List of all currencies used (for reference)
      }));
    } catch (error: any) {
      // If tenant doesn't exist, return empty array
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return [];
      }
      throw error;
    }
  }
}
