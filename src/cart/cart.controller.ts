import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService } from './cart.service';
import { AuthenticatedRequest } from '../types/request.types';
import { Public } from '../auth/public.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  private getTenantId(req: any, headers: any): string {
    return req.user?.tenantId || req.tenantId || headers['x-tenant-id'] || process.env.DEFAULT_TENANT_ID || 'default';
  }

  private getSessionId(req: any, headers: any): string {
    return headers['x-session-id'] || (req.user?.id ? `user-${req.user.id}` : `session-${Date.now()}`);
  }

  @Public()
  @Get()
  async getCart(
    @Request() req: any,
    @Headers() headers: any
  ) {
    const tenantId = this.getTenantId(req, headers);
    const sessionId = this.getSessionId(req, headers);
    const userId = req.user?.id;
    
    return this.cartService.getOrCreateCart(tenantId, sessionId, userId);
  }

  @Public()
  @Post('items')
  async addToCart(
    @Request() req: any,
    @Headers() headers: any,
    @Body() body: { productId: string; quantity: number; productVariantId?: string },
  ) {
    const tenantId = this.getTenantId(req, headers);
    const sessionId = this.getSessionId(req, headers);
    const userId = req.user?.id;
    
    const cart = await this.cartService.getOrCreateCart(tenantId, sessionId, userId);
    
    return this.cartService.addToCart(
      tenantId,
      cart.id,
      body.productId,
      body.quantity,
      body.productVariantId,
    );
  }

  @Public()
  @Put('items/:itemId')
  async updateCartItem(
    @Request() req: any,
    @Headers() headers: any,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
  ) {
    const tenantId = this.getTenantId(req, headers);
    const sessionId = this.getSessionId(req, headers);
    const userId = req.user?.id;
    
    const cart = await this.cartService.getOrCreateCart(tenantId, sessionId, userId);
    
    return this.cartService.updateCartItem(
      tenantId,
      cart.id,
      itemId,
      body.quantity,
    );
  }

  @Public()
  @Delete('items/:itemId')
  async removeFromCart(
    @Request() req: any,
    @Headers() headers: any,
    @Param('itemId') itemId: string,
  ) {
    const tenantId = this.getTenantId(req, headers);
    const sessionId = this.getSessionId(req, headers);
    const userId = req.user?.id;
    
    const cart = await this.cartService.getOrCreateCart(tenantId, sessionId, userId);
    
    return this.cartService.removeFromCart(tenantId, cart.id, itemId);
  }

  @Public()
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(
    @Request() req: any,
    @Headers() headers: any
  ) {
    const tenantId = this.getTenantId(req, headers);
    const sessionId = this.getSessionId(req, headers);
    const userId = req.user?.id;
    
    const cart = await this.cartService.getOrCreateCart(tenantId, sessionId, userId);
    
    return this.cartService.clearCart(tenantId, cart.id);
  }

  @Post('merge')
  async mergeCarts(
    @Request() req: AuthenticatedRequest,
    @Body() body: { sessionCartId: string },
  ) {
    // This endpoint still requires auth as it merges a session cart into a user cart
    const userCart = await this.cartService.getOrCreateCart(req.tenantId, undefined, req.user.id);
    
    return this.cartService.mergeCarts(
      req.tenantId,
      body.sessionCartId,
      userCart.id,
    );
  }

  @Public()
  @Get('total')
  async getCartTotal(
    @Request() req: any,
    @Headers() headers: any
  ) {
    const tenantId = this.getTenantId(req, headers);
    const sessionId = this.getSessionId(req, headers);
    const userId = req.user?.id;
    
    const cart = await this.cartService.getOrCreateCart(tenantId, sessionId, userId);
    const totals = await this.cartService.calculateCartTotal(cart);
    
    return {
      cartId: cart.id,
      itemsCount: cart.cartItems.length,
      ...totals,
    };
  }
}