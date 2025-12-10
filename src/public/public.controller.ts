import { Controller, Get, Query } from '@nestjs/common';
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
}
