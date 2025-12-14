import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all active partners for public display
   * Returns only public-safe data (no sensitive information)
   */
  async getActivePartners() {
    try {
      const partners = await this.prisma.partner.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          nameAr: true,
          logo: true,
          description: true,
          descriptionAr: true,
          website: true,
          // Only return public information
          // Don't expose email, phone, commission details
        },
        orderBy: { createdAt: 'asc' },
      });

      // Map to a format suitable for the landing page
      return {
        partners: partners.map((partner) => ({
          id: partner.id,
          name: partner.name,
          nameAr: partner.nameAr || partner.name,
          logo: partner.logo || `/partners/${partner.name.toLowerCase().replace(/\s+/g, '-')}-logo.png`,
          description: partner.description || '',
          descriptionAr: partner.descriptionAr || partner.description || '',
          website: partner.website,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch active partners:', error);
      return { partners: [] };
    }
  }

  /**
   * Get all active subscription plans for public display
   */
  async getActivePlans(billingCycle?: string) {
    try {
      const where: any = { isActive: true };
      if (billingCycle) {
        where.billingCycle = billingCycle;
      }

      const plans = await this.prisma.subscriptionPlan.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          nameAr: true,
          description: true,
          descriptionAr: true,
          price: true,
          currency: true,
          billingCycle: true,
          features: true,
          featuresAr: true,
          limits: true,
          isPopular: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' },
      });

      return {
        plans: plans.map((plan) => ({
          ...plan,
          price: plan.price.toString(), // Convert Decimal to string for JSON
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch active plans:', error);
      // Return default plans as fallback
      return {
        plans: [
          {
            id: 'starter',
            code: 'STARTER',
            name: 'Starter',
            nameAr: 'المبتدئ',
            description: 'Perfect for small businesses',
            descriptionAr: 'مثالية للأعمال الصغيرة',
            price: '99',
            currency: 'SAR',
            billingCycle: 'MONTHLY',
            features: ['Up to 100 products', 'Basic analytics', 'Email support'],
            featuresAr: ['حتى 100 منتج', 'تحليلات أساسية', 'دعم بالبريد الإلكتروني'],
            limits: { products: 100, orders: 500, storage: 5, staff: 2 },
            isPopular: false,
            sortOrder: 1,
          },
          {
            id: 'professional',
            code: 'PROFESSIONAL',
            name: 'Professional',
            nameAr: 'المحترف',
            description: 'For growing businesses',
            descriptionAr: 'للأعمال النامية',
            price: '299',
            currency: 'SAR',
            billingCycle: 'MONTHLY',
            features: ['Unlimited products', 'Advanced analytics', 'Priority support', 'Custom domain'],
            featuresAr: ['منتجات غير محدودة', 'تحليلات متقدمة', 'دعم أولوية', 'نطاق مخصص'],
            limits: { products: -1, orders: -1, storage: 50, staff: 10 },
            isPopular: true,
            sortOrder: 2,
          },
          {
            id: 'enterprise',
            code: 'ENTERPRISE',
            name: 'Enterprise',
            nameAr: 'المؤسسات',
            description: 'For large enterprises',
            descriptionAr: 'للمؤسسات الكبيرة',
            price: '999',
            currency: 'SAR',
            billingCycle: 'MONTHLY',
            features: ['Everything in Pro', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'],
            featuresAr: ['كل مميزات المحترف', 'مدير حساب مخصص', 'تكاملات مخصصة', 'ضمان SLA'],
            limits: { products: -1, orders: -1, storage: -1, staff: -1 },
            isPopular: false,
            sortOrder: 3,
          },
        ],
      };
    }
  }

  /**
   * Get supported payment providers
   */
  async getPaymentProviders() {
    try {
      // Get unique active payment providers from all payment methods
      const paymentMethods = await this.prisma.paymentMethod.findMany({
        where: { isActive: true },
        select: { provider: true },
        distinct: ['provider'],
      });

      // Map providers to display format
      const providerDetails: Record<string, any> = {
        HYPERPAY: {
          id: 'hyperpay',
          name: 'HyperPay',
          nameAr: 'هايبر باي',
          logo: '/payment/hyperpay.svg',
          description: 'Secure payment gateway for MENA region',
          descriptionAr: 'بوابة دفع آمنة لمنطقة الشرق الأوسط',
        },
        STRIPE: {
          id: 'stripe',
          name: 'Stripe',
          nameAr: 'سترايب',
          logo: '/payment/stripe.svg',
          description: 'Global payment processing platform',
          descriptionAr: 'منصة معالجة مدفوعات عالمية',
        },
        PAYPAL: {
          id: 'paypal',
          name: 'PayPal',
          nameAr: 'باي بال',
          logo: '/payment/paypal.svg',
          description: 'Trusted worldwide payment solution',
          descriptionAr: 'حل دفع موثوق عالمياً',
        },
        CASH_ON_DELIVERY: {
          id: 'cod',
          name: 'Cash on Delivery',
          nameAr: 'الدفع عند الاستلام',
          logo: '/payment/cod.svg',
          description: 'Pay when you receive your order',
          descriptionAr: 'الدفع عند استلام طلبك',
        },
      };

      const providers = paymentMethods.map((pm) => providerDetails[pm.provider] || {
        id: pm.provider.toLowerCase(),
        name: pm.provider,
        nameAr: pm.provider,
        logo: '/payment/default.svg',
      });

      // If no providers in DB, return default supported ones
      if (providers.length === 0) {
        return {
          providers: [
            providerDetails.HYPERPAY,
            providerDetails.STRIPE,
            providerDetails.PAYPAL,
            providerDetails.CASH_ON_DELIVERY,
          ],
        };
      }

      return { providers };
    } catch (error) {
      this.logger.error('Failed to fetch payment providers:', error);
      return {
        providers: [
          {
            id: 'hyperpay',
            name: 'HyperPay',
            nameAr: 'هايبر باي',
            logo: '/payment/hyperpay.svg',
          },
          {
            id: 'stripe',
            name: 'Stripe',
            nameAr: 'سترايب',
            logo: '/payment/stripe.svg',
          },
        ],
      };
    }
  }

  /**
   * Get platform statistics for landing page
   */
  async getPlatformStats() {
    try {
      const [
        totalStores,
        totalOrders,
        totalProducts,
      ] = await Promise.all([
        this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        this.prisma.order.count(),
        this.prisma.product.count({ where: { isPublished: true } }),
      ]);

      return {
        stats: {
          stores: this.formatNumber(totalStores),
          orders: this.formatNumber(totalOrders),
          products: this.formatNumber(totalProducts),
          uptime: '99.9%',
          support: '24/7',
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch platform stats:', error);
      return {
        stats: {
          stores: '1,000+',
          orders: '50,000+',
          products: '100,000+',
          uptime: '99.9%',
          support: '24/7',
        },
      };
    }
  }

  /**
   * Get testimonials for landing page
   */
  async getTestimonials(limit: number = 6) {
    // In a real implementation, this would fetch from a reviews/testimonials table
    // For now, return sample testimonials
    return {
      testimonials: [
        {
          id: '1',
          name: 'أحمد محمد',
          nameEn: 'Ahmed Mohammed',
          role: 'مالك متجر الإلكترونيات',
          roleEn: 'Electronics Store Owner',
          content: 'منصة رائعة! زادت مبيعاتي 300% في 6 أشهر.',
          contentEn: 'Amazing platform! My sales increased 300% in 6 months.',
          rating: 5,
        },
        {
          id: '2',
          name: 'فاطمة علي',
          nameEn: 'Fatima Ali',
          role: 'مالكة متجر الأزياء',
          roleEn: 'Fashion Store Owner',
          content: 'سهولة الاستخدام والدعم الممتاز جعلا تجربتي استثنائية.',
          contentEn: 'Ease of use and excellent support made my experience exceptional.',
          rating: 5,
        },
        {
          id: '3',
          name: 'خالد سعيد',
          nameEn: 'Khaled Saeed',
          role: 'مالك متجر رقمي',
          roleEn: 'Digital Store Owner',
          content: 'أفضل منصة جربتها. التقارير مفيدة جداً.',
          contentEn: 'Best platform I have tried. The reports are very useful.',
          rating: 5,
        },
      ].slice(0, limit),
    };
  }

  // Helper methods

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K+`;
    }
    if (num > 0) {
      return `${num}+`;
    }
    return '1,000+'; // Default fallback
  }

  private getPartnerLogoPath(name: string): string {
    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');
    return `/partners/${normalizedName}-logo.png`;
  }

  private getPartnerDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'ASUS': 'Products supplier partner - Get gaming cards, PUBG, PlayStation cards directly from ASUS',
      'Smart Line': 'Marketing and social media partner - Integrated marketing solutions and professional social media management',
    };
    return descriptions[name] || 'Trusted business partner';
  }

  private getPartnerDescriptionAr(name: string): string {
    const descriptions: Record<string, string> = {
      'ASUS': 'شريك توريد المنتجات - احصل على بطاقات الألعاب، شدات PUBG، وبطاقات PlayStation مباشرة من ASUS',
      'Smart Line': 'شريك التسويق والسوشيال ميديا - حلول تسويقية متكاملة وإدارة احترافية لحسابات التواصل الاجتماعي',
    };
    return descriptions[name] || 'شريك أعمال موثوق';
  }
}
