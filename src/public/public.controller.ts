import { Controller, Get, Query, Param, Request } from '@nestjs/common';
import { PublicService } from './public.service';

/**
 * Public API Controller
 * 
 * This controller provides public endpoints that don't require authentication.
 * Used for storefront landing pages to display:
 * - Active partners
 * - Available subscription plans
 * - Supported payment providers
 * - Platform statistics
 */
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /**
   * Get all active partners
   * Used to display partner logos and information on the landing page
   */
  @Get('partners')
  async getActivePartners() {
    return this.publicService.getActivePartners();
  }

  /**
   * Get all active subscription plans
   * Used to display pricing/plans section on the landing page
   */
  @Get('plans')
  async getActivePlans(
    @Query('billingCycle') billingCycle?: string,
  ) {
    return this.publicService.getActivePlans(billingCycle);
  }

  /**
   * Get supported payment providers
   * Used to display payment methods on the landing page
   */
  @Get('payment-providers')
  async getPaymentProviders() {
    return this.publicService.getPaymentProviders();
  }

  /**
   * Get platform statistics for landing page
   * Returns aggregated stats like total stores, orders, etc.
   */
  @Get('stats')
  async getPlatformStats() {
    return this.publicService.getPlatformStats();
  }

  /**
   * Get testimonials/reviews for landing page
   */
  @Get('testimonials')
  async getTestimonials(@Query('limit') limit?: string) {
    return this.publicService.getTestimonials(limit ? parseInt(limit) : 6);
  }

  /**
   * Get content for static pages (about, contact, privacy)
   */
  @Get('pages/:slug')
  async getPageContent(@Param('slug') slug: string) {
    return this.publicService.getPageContent(slug);
  }

  /**
   * Check subdomain availability and get suggestions
   */
  @Get('check-subdomain')
  async checkSubdomain(@Query('subdomain') subdomain: string) {
    return this.publicService.checkSubdomainAvailability(subdomain);
  }

  /**
   * Get active banks for checkout (public endpoint)
   * Customers can see merchant bank accounts during payment
   * Tenant is resolved from subdomain/headers by middleware
   */
  @Get('banks')
  async getBanksForCheckout(@Request() req: any, @Query('tenantId') tenantId?: string) {
    // Priority: 1. Query param, 2. Middleware (req.tenantId), 3. Request header
    const effectiveTenantId = tenantId || req.tenantId || req.headers['x-tenant-id'];
    
    if (!effectiveTenantId || effectiveTenantId === 'default' || effectiveTenantId === 'system') {
      return { banks: [] };
    }
    
    return this.publicService.getBanksForCheckout(effectiveTenantId);
  }
}
