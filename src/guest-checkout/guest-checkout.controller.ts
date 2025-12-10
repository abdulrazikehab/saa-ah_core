import { Controller, Post, Get, Body, Query, Headers, UseGuards } from '@nestjs/common';
import { GuestCheckoutService } from './guest-checkout.service';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('guest-checkout')
export class GuestCheckoutController {
  constructor(private readonly guestCheckoutService: GuestCheckoutService) {}

  /**
   * Create a guest order (no authentication required)
   * POST /api/guest-checkout/order
   */
  @Public()
  @Post('order')
  async createGuestOrder(
    @Headers('x-tenant-domain') tenantDomain: string,
    @Body() orderData: any,
  ) {
    // Extract tenant ID from domain (handled by middleware)
    const tenantId = orderData.tenantId || 'default';

    return this.guestCheckoutService.createGuestOrder(tenantId, {
      ...orderData,
      ipAddress: orderData.ipAddress || 'unknown',
    });
  }

  /**
   * Track guest order by order number and email
   * GET /api/guest-checkout/track?orderNumber=XXX&email=xxx@example.com
   */
  @Public()
  @Get('track')
  async trackGuestOrder(
    @Query('orderNumber') orderNumber: string,
    @Query('email') email: string,
  ) {
    return this.guestCheckoutService.getGuestOrder(orderNumber, email);
  }

  /**
   * Get checkout settings (public, for displaying on checkout page)
   * GET /api/guest-checkout/settings
   */
  @Public()
  @Get('settings')
  async getCheckoutSettings(@Headers('x-tenant-domain') tenantDomain: string) {
    const tenantId = 'default'; // Will be resolved by middleware
    return this.guestCheckoutService.getCheckoutSettings(tenantId);
  }

  /**
   * Update checkout settings (admin only)
   * POST /api/guest-checkout/settings
   */
  @UseGuards(JwtAuthGuard)
  @Post('settings')
  async updateCheckoutSettings(
    @Headers('x-tenant-domain') tenantDomain: string,
    @Body() settings: any,
  ) {
    const tenantId = 'default'; // Will be resolved from JWT
    return this.guestCheckoutService.updateCheckoutSettings(tenantId, settings);
  }
}
