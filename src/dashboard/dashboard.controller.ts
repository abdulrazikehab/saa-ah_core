import { Controller, Get, Post, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SiteConfigService } from '../site-config/site-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

/**
 * Dashboard controller for tenant statistics and configuration
 */
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly siteConfig: SiteConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get dashboard statistics for the tenant
   * Public endpoint so storefront can display stats if needed
   */
  @Public()
  @Get('stats')
  async getStats(@Request() req: any) {
    const tenantId = req.tenantId || process.env.DEFAULT_TENANT_ID || 'default';

    const [orderCount, revenueData, productCount, customerCount, lowStockCount] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.aggregate({
        where: { 
          tenantId,
          paymentStatus: 'SUCCEEDED',
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.product.count({ where: { tenantId } }),
      // Count unique customers from orders
      this.prisma.order.groupBy({
        by: ['customerEmail'],
        where: { tenantId },
      }).then((groups: any[]) => groups.length),
      // Count low stock products (stock < 10)
      this.prisma.product.count({
        where: {
          tenantId,
          variants: {
            some: {
              inventoryQuantity: { lt: 10 }
            }
          }
        }
      })
    ]);

    // Calculate visits (can be enhanced with analytics service)
    const visits = customerCount * 3; // Rough estimate: 3 visits per customer
    const saved = Math.floor(orderCount * 0.15); // Estimate: 15% of orders are saved

    return {
      orderCount,
      revenue: Number(revenueData._sum.totalAmount || 0),
      productCount,
      customerCount,
      visits,
      saved,
      lowStockProducts: lowStockCount,
      pendingOrders: await this.prisma.order.count({
        where: { tenantId, status: 'PENDING' }
      }),
    };
  }

  /**
   * Get customers list with loyalty information
   */
  @Get('customers')
  async getCustomers(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    // 1. Fetch registered users
    const users = await this.prisma.user.findMany({
      where: { 
        tenantId,
        role: 'CUSTOMER' 
      },
      select: {
        email: true,
        name: true,
        createdAt: true,
      }
    });

    // 2. Fetch orders
    const orders = await this.prisma.order.findMany({
      where: { tenantId },
      select: {
        customerEmail: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Merge data
    const customerMap = new Map();

    // Add registered users first
    users.forEach((user: any) => {
      customerMap.set(user.email, {
        id: user.email,
        email: user.email,
        name: user.name || 'عميل مسجل',
        phone: '',
        totalOrders: 0,
        totalSpent: 0,
        loyaltyPoints: 0,
        loyaltyTier: 'bronze',
        createdAt: user.createdAt,
        lastOrderDate: null,
        isRegistered: true
      });
    });

    // Merge with order data
    orders.forEach((order: any) => {
      const email = order.customerEmail;
      if (!customerMap.has(email)) {
        customerMap.set(email, {
          id: email,
          email,
          name: order.customerName || 'عميل زائر',
          phone: order.customerPhone,
          totalOrders: 0,
          totalSpent: 0,
          loyaltyPoints: 0,
          loyaltyTier: 'bronze',
          createdAt: order.createdAt,
          lastOrderDate: order.createdAt,
          isRegistered: false
        });
      }
      
      const customer = customerMap.get(email);
      customer.totalOrders += 1;
      customer.totalSpent += Number(order.totalAmount);
      customer.loyaltyPoints = Math.floor(customer.totalSpent / 10); // 1 point per 10 SAR
      
      // Update phone if missing
      if (!customer.phone && order.customerPhone) {
        customer.phone = order.customerPhone;
      }

      // Update last order date
      if (!customer.lastOrderDate || new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.createdAt;
      }
      
      // Determine loyalty tier
      if (customer.totalSpent >= 5000) {
        customer.loyaltyTier = 'gold';
      } else if (customer.totalSpent >= 2000) {
        customer.loyaltyTier = 'silver';
      }
    });

    const customers = Array.from(customerMap.values())
      .slice(skip, skip + limitNum);

    return {
      customers,
      total: customerMap.size,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * Get loyalty programs
   */
  @Get('loyalty-programs')
  async getLoyaltyPrograms(@Request() req: any) {
    const tenantId = req.tenantId || process.env.DEFAULT_TENANT_ID || 'default';

    // Get customer stats
    const customers = await this.getCustomers(req, '1', '1000');
    const allCustomers = customers.customers;

    return {
      programs: [
        {
          id: '1',
          name: 'برنامج الولاء الأساسي',
          description: 'برنامج الولاء الافتراضي لجميع العملاء',
          members: allCustomers.length,
          minPoints: 0,
          benefits: ['نقطة واحدة لكل 10 ريال', 'عروض حصرية', 'شحن مجاني للطلبات فوق 200 ريال']
        },
        {
          id: '2',
          name: 'العضوية الفضية',
          description: 'للعملاء الذين أنفقوا أكثر من 2000 ريال',
          members: allCustomers.filter((c: any) => c.loyaltyTier === 'silver' || c.loyaltyTier === 'gold').length,
          minPoints: 200,
          benefits: ['خصم 5%', 'نقاط مضاعفة', 'شحن مجاني دائماً', 'دعم أولوية']
        },
        {
          id: '3',
          name: 'العضوية الذهبية',
          description: 'للعملاء المميزين الذين أنفقوا أكثر من 5000 ريال',
          members: allCustomers.filter((c: any) => c.loyaltyTier === 'gold').length,
          minPoints: 500,
          benefits: ['خصم 10%', 'نقاط ثلاثية', 'شحن مجاني سريع', 'وصول مبكر للمنتجات الجديدة', 'هدايا مجانية']
        }
      ]
    };
  }

  /**
   * Get customers with fingerprint/security data
   * Returns list of customers who have logged in, with their device info
   */
  @Get('customers-fingerprints')
  async getCustomersFingerprints(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const skip = (pageNum - 1) * limitNum;

    // Fetch SecurityEvents of type DEVICE_FINGERPRINT for this tenant
    const securityEvents = await this.prisma.securityEvent.findMany({
      where: {
        tenantId,
        type: 'DEVICE_FINGERPRINT',
      },
      select: {
        id: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limitNum,
      skip,
    });

    // Transform into customer fingerprint records
    const customerFingerprints = securityEvents.map((event: any) => {
      const meta = typeof event.metadata === 'string' 
        ? JSON.parse(event.metadata) 
        : event.metadata || {};
      
      return {
        id: event.id,
        email: meta.email || event.user?.email || 'Unknown',
        name: event.user?.name || meta.email?.split('@')[0] || 'Unknown',
        userId: event.user?.id,
        ipAddress: event.ipAddress,
        os: meta.os || 'Unknown',
        isVpn: meta.isVpn || false,
        isVM: meta.fingerprint?.isVM || false,
        riskScore: meta.fingerprint?.riskScore || 0,
        visitorId: meta.fingerprint?.visitorId || 'Unknown',
        relatedEmails: meta.relatedEmails || [],
        createdAt: event.createdAt,
        userAgent: event.userAgent,
      };
    });

    // Get total count
    const total = await this.prisma.securityEvent.count({
      where: {
        tenantId,
        type: 'DEVICE_FINGERPRINT',
      }
    });

    return {
      customers: customerFingerprints,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }
}
