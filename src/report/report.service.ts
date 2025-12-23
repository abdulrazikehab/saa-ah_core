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
      
      // Round revenue to 2 decimal places for precision
      const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
      
      return {
        totalOrders,
        revenue: roundCurrency(Number(revenue._sum.totalAmount ?? 0)),
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

  async getProductReport(tenantId: string, page: number = 1, limit: number = 20, search?: string) {
    if (!tenantId) {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
    try {
      // Build where clause with optional search
      const where: any = { tenantId };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get total count first
      const total = await this.prisma.product.count({ where });

      const products = await this.prisma.product.findMany({
        where,
        include: {
          variants: {
            select: {
              inventoryQuantity: true
            }
          },
          orderItems: {
            where: {
              order: {
                paymentStatus: 'SUCCEEDED' // Only count completed orders
              }
            },
            select: {
              quantity: true,
              price: true
            }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      // Helper function to round currency to 2 decimal places
      const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

      const data = products.map((p: any) => {
        // Calculate total stock from variants (inventoryQuantity field)
        const totalStock = p.variants?.reduce((sum: number, v: any) => sum + (Number(v.inventoryQuantity || 0)), 0) || 0;
        
        // Calculate sales count and revenue with precision
        const salesCount = p.orderItems.reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0);
        const revenue = roundCurrency(
          p.orderItems.reduce((acc: number, item: any) => {
            const itemRevenue = Number(item.price || 0) * Number(item.quantity || 0);
            return acc + itemRevenue;
          }, 0)
        );
        
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: totalStock,
          salesCount,
          revenue
        };
      });

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      // If tenant doesn't exist, return empty response
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
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

      // Round currency to 2 decimal places for precision
      const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
      
      return customers.map((c: any) => ({
        email: c.customerEmail,
        name: c.customerName || 'Unknown',
        orders: c._count.id,
        totalSpent: roundCurrency(Number(c._sum.totalAmount ?? 0))
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

      // Round currency to 2 decimal places for precision
      const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
      
      return payments.map((p: any) => ({
        provider: p.paymentProvider,
        transactions: p._count.id,
        volume: roundCurrency(Number(p._sum.amount ?? 0)),
        fees: roundCurrency(Number(p._sum.platformFee ?? 0)),
        net: roundCurrency(Number(p._sum.merchantEarnings ?? 0)),
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

  async getSalesReport(tenantId: string, startDate?: Date, endDate?: Date) {
    if (!tenantId) {
      return {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        byDate: [],
      };
    }
    try {
      const where: any = {
        tenantId,
        paymentStatus: 'SUCCEEDED',
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const orders = await this.prisma.order.findMany({
        where,
        select: {
          totalAmount: true,
          createdAt: true,
        },
      });

      const totalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      // Group by date
      const byDateMap = new Map<string, { count: number; amount: number }>();
      orders.forEach((order: any) => {
        const dateKey = order.createdAt.toISOString().split('T')[0];
        const existing = byDateMap.get(dateKey) || { count: 0, amount: 0 };
        existing.count += 1;
        existing.amount += Number(order.totalAmount || 0);
        byDateMap.set(dateKey, existing);
      });

      const byDate = Array.from(byDateMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          amount: Number(data.amount.toFixed(2)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

      return {
        totalSales: roundCurrency(totalSales),
        totalOrders,
        averageOrderValue: roundCurrency(averageOrderValue),
        byDate,
      };
    } catch (error: any) {
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        return {
          totalSales: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          byDate: [],
        };
      }
      throw error;
    }
  }
}
