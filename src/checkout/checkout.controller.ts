import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { CartService } from '../cart/cart.service'; // Import CartService
import { GuestCheckoutService } from '../guest-checkout/guest-checkout.service';
import { AuthenticatedRequest } from '../types/request.types';

@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(
    private checkoutService: CheckoutService,
    private cartService: CartService, // Inject CartService
    private guestCheckoutService: GuestCheckoutService,
  ) {}

  private ensureTenantId(tenantId: string | undefined): string {
    // Use provided tenantId, or fall back to default
    return tenantId || process.env.DEFAULT_TENANT_ID || 'default';
  }

  @Post()
  async createOrder(
    @Request() req: AuthenticatedRequest,
    @Body() body: {
      customerEmail: string;
      customerName?: string;
      shippingAddress?: any;
      billingAddress?: any;
      customerPhone?: string;
    },
  ) {
    const sessionId = this.getSessionId(req);
    const userId = req.user?.id;
    const tenantId = this.ensureTenantId(req.tenantId);
    
    // Get or create cart properly
    const cart = await this.cartService.getOrCreateCart(
      tenantId,
      sessionId,
      userId,
    );

    return this.checkoutService.createOrderFromCart(
      tenantId,
      cart.id,
      body.customerEmail,
      body.customerName,
      body.shippingAddress,
      body.billingAddress,
      body.customerPhone,
      undefined, // notes
      req.ip || req.socket.remoteAddress || '',
    );
  }

  @Get('settings')
  async getCheckoutSettings(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.tenantId || 'default';
    return this.guestCheckoutService.getCheckoutSettings(tenantId);
  }

  @Put('settings')
  async updateCheckoutSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: any,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId || 'default';
    return this.guestCheckoutService.updateCheckoutSettings(tenantId, settings);
  }

  // ... rest of the methods

  private getSessionId(req: AuthenticatedRequest): string {
    return req.headers['x-session-id'] as string || `session-${Date.now()}`;
  }
}