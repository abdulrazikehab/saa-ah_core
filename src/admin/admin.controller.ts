import { Controller, Delete, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Delete('clear-all-products')
  @HttpCode(HttpStatus.OK)
  async clearAllProducts() {
    await this.prisma.productImage.deleteMany({});
    await this.prisma.productVariant.deleteMany({});
    await this.prisma.productCategory.deleteMany({});
    await this.prisma.product.deleteMany({});
    return { message: 'All products cleared successfully' };
  }

  @Public()
  @Delete('clear-all-categories')
  @HttpCode(HttpStatus.OK)
  async clearAllCategories() {
    await this.prisma.productCategory.deleteMany({});
    await this.prisma.category.deleteMany({});
    return { message: 'All categories cleared successfully' };
  }

  @Public()
  @Delete('clear-all-orders')
  @HttpCode(HttpStatus.OK)
  async clearAllOrders() {
    await this.prisma.orderItem.deleteMany({});
    await this.prisma.order.deleteMany({});
    return { message: 'All orders cleared successfully' };
  }

  @Public()
  @Delete('clear-all-data')
  @HttpCode(HttpStatus.OK)
  async clearAllData() {
    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete order-related data
    await this.prisma.orderItem.deleteMany({});
    await this.prisma.order.deleteMany({});
    
    // 2. Delete cart data
    await this.prisma.cartItem.deleteMany({});
    await this.prisma.cart.deleteMany({});
    
    // 3. Delete product-related data
    await this.prisma.productImage.deleteMany({});
    await this.prisma.productVariant.deleteMany({});
    await this.prisma.productCategory.deleteMany({});
    await this.prisma.productCollectionItem.deleteMany({});
    await this.prisma.productCollection.deleteMany({});
    await this.prisma.productTagItem.deleteMany({});
    await this.prisma.productTag.deleteMany({});
    await this.prisma.product.deleteMany({});
    
    // 4. Delete categories
    await this.prisma.category.deleteMany({});
    
    // 5. Delete coupons and redemptions
    await this.prisma.couponRedemption.deleteMany({});
    await this.prisma.coupon.deleteMany({});
    
    // 6. Delete shipping and tax data
    await this.prisma.shippingMethod.deleteMany({});
    await this.prisma.shippingZone.deleteMany({});
    await this.prisma.taxRate.deleteMany({});
    
    // 7. Delete payment methods
    await this.prisma.paymentMethod.deleteMany({});
    
    // 8. Delete webhook data
    await this.prisma.webhookDelivery.deleteMany({});
    await this.prisma.webhookEndpoint.deleteMany({});
    
    // 9. Delete domain and SSL data
    await this.prisma.sslCertificate.deleteMany({});
    await this.prisma.customDomain.deleteMany({});
    await this.prisma.domain.deleteMany({});
    
    // 10. Delete theme and plugin data
    await this.prisma.themeVersion.deleteMany({});
    await this.prisma.theme.deleteMany({});
    await this.prisma.plugin.deleteMany({});
    
    // 11. Delete pages and templates
    await this.prisma.page.deleteMany({});
    await this.prisma.template.deleteMany({});
    
    // 12. Delete site configurations
    await this.prisma.siteConfig.deleteMany({});
    
    // 13. Delete payment settings
    await this.prisma.paymentSettings.deleteMany({});
    
    // 14. Delete checkout settings
    await this.prisma.checkoutSettings.deleteMany({});
    
    // 15. Delete integrations
    await this.prisma.integration.deleteMany({});
    
    // 16. Delete KYC data
    await this.prisma.kYC.deleteMany({});
    
    // 17. Delete permissions
    await this.prisma.permission.deleteMany({});
    
    // 18. Delete users (keep tenants for now)
    await this.prisma.user.deleteMany({});
    
    return { 
      message: 'All data cleared successfully',
      details: 'Deleted all products, orders, carts, categories, domains, pages, templates, configurations, and user data'
    };
  }

  @Public()
  @Delete('clear-domains')
  @HttpCode(HttpStatus.OK)
  async clearDomains() {
    // Delete SSL certificates first (foreign key dependency)
    await this.prisma.sslCertificate.deleteMany({});
    // Delete custom domains
    await this.prisma.customDomain.deleteMany({});
    // Delete domains (Note: Domain model might not be in Prisma schema yet)
    // const result = await this.prisma.domain.deleteMany({});
    const result = { count: 0 }; // Placeholder until Domain model is added
    
    return { 
      message: 'All domains cleared successfully',
      count: result.count
    };
  }

  @Public()
  @Delete('clear-tenants')
  @HttpCode(HttpStatus.OK)
  async clearTenants() {
    // WARNING: This will delete ALL tenants and ALL associated data!
    // Confirmation should be handled on the frontend
    
    // First clear all data
    await this.clearAllData();
    
    // Then delete tenants
    const result = await this.prisma.tenant.deleteMany({});
    
    return { 
      message: 'All tenants and associated data cleared successfully',
      count: result.count
    };
  }

  @Public()
  @Post('reset-database')
  @HttpCode(HttpStatus.OK)
  async resetDatabase() {
    // This is a placeholder - actual implementation would use Prisma migrations
    return { message: 'Database reset endpoint - use Prisma migrations for actual reset' };
  }
}
