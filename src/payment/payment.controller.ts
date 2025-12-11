import { Controller, Get, Post, Put, Body, Param, Headers, UseGuards, Request } from '@nestjs/common';
import { PaymentSettingsService } from './payment-settings.service';
import { HyperPayService } from './hyperpay.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentSettings: PaymentSettingsService,
    private readonly hyperPay: HyperPayService,
  ) {}

  /**
   * Get payment settings (admin only)
   * GET /api/payment/settings
   */
  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId || req.user?.id || 'default';
    if (!tenantId || tenantId === 'default') {
      // Try to get tenantId from user record if available
      if (req.user?.id) {
        // Could fetch from user record, but for now use default
      }
    }
    return this.paymentSettings.getSettings(tenantId);
  }

  /**
   * Get available payment methods for checkout (public)
   * GET /api/payment/methods
   */
  @Public()
  @Get('methods')
  async getAvailableMethods(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId || req.user?.id || 'default';
    return this.paymentSettings.getAvailablePaymentMethods(tenantId);
  }

  /**
   * Update payment settings (admin only)
   * PUT /api/payment/settings
   */
  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateSettings(@Request() req: any, @Body() data: any) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId || 'default';
    return this.paymentSettings.updateSettings(tenantId, data);
  }

  /**
   * Test HyperPay connection (admin only)
   * POST /api/payment/hyperpay/test
   */
  @UseGuards(JwtAuthGuard)
  @Post('hyperpay/test')
  async testHyperPay(@Body() data: any) {
    return this.paymentSettings.testHyperPayConnection(
      data.entityId,
      data.accessToken,
      data.testMode,
    );
  }

  /**
   * Create HyperPay checkout (public, for checkout page)
   * POST /api/payment/hyperpay/checkout
   */
  @Public()
  @Post('hyperpay/checkout')
  async createHyperPayCheckout(
    @Headers('x-tenant-domain') tenantDomain: string,
    @Body() orderData: any,
  ) {
    const tenantId = 'default'; // Will be resolved by middleware
    const settings = await this.paymentSettings.getSettings(tenantId);
    return this.hyperPay.createCheckout(settings, orderData);
  }

  /**
   * Get HyperPay payment status (public, for return URL)
   * GET /api/payment/hyperpay/status/:checkoutId
   */
  @Public()
  @Get('hyperpay/status/:checkoutId')
  async getHyperPayStatus(
    @Headers('x-tenant-domain') tenantDomain: string,
    @Param('checkoutId') checkoutId: string,
  ) {
    const tenantId = 'default'; // Will be resolved by middleware
    const settings = await this.paymentSettings.getSettings(tenantId);
    return this.hyperPay.getPaymentStatus(settings, checkoutId);
  }

  /**
   * HyperPay webhook endpoint (public, called by HyperPay)
   * POST /api/payment/hyperpay/webhook
   */
  @Public()
  @Post('hyperpay/webhook')
  async hyperPayWebhook(@Body() data: any) {
    return this.hyperPay.processWebhook(data);
  }

  /**
   * Refund a payment (admin only)
   * POST /api/payment/hyperpay/refund/:transactionId
   */
  @UseGuards(JwtAuthGuard)
  @Post('hyperpay/refund/:transactionId')
  async refundPayment(
    @Request() req: any,
    @Param('transactionId') transactionId: string,
    @Body() data: { amount?: number },
  ) {
    const tenantId = req.user?.tenantId || 'default';
    const settings = await this.paymentSettings.getSettings(tenantId);
    return this.hyperPay.refundPayment(settings, transactionId, data.amount);
  }
}