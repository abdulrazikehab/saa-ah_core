// apps/app-core/src/order/order.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService, CreateOrderDto, OrderResponseDto } from './order.service';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  private ensureTenantId(req: AuthenticatedRequest): string {
    // For customers, prioritize middleware tenantId (from subdomain) over JWT tenantId
    // This ensures cart/order operations use the correct store context
    const isCustomer = req.user?.role === 'CUSTOMER' || req.user?.role === 'customer';
    
    // Try multiple sources for tenantId - prioritize middleware for customers
    let tenantId: string | undefined;
    if (isCustomer) {
      // For customers, middleware tenantId (from subdomain) is most reliable
      tenantId = req.tenantId || req.user?.tenantId;
    } else {
      // For merchants/admins, user's tenantId is primary
      tenantId = req.user?.tenantId || req.tenantId;
    }
    
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      // For customer requests, try to get tenantId from default tenant or allow null
      const defaultTenant = process.env.DEFAULT_TENANT_ID;
      if (defaultTenant && defaultTenant !== 'default' && defaultTenant !== 'system') {
        this.logger.warn('Tenant ID missing, using default tenant', { user: req.user, tenantId: req.tenantId });
        return defaultTenant;
      }
      // If still no tenantId, check if this is a customer request (might not have tenantId)
      if (isCustomer) {
        // For customers, we might not have tenantId in JWT, so we'll need to handle this differently
        // For now, throw the error but with a more helpful message
        this.logger.warn('Tenant ID missing in customer request', { user: req.user, tenantId: req.tenantId });
        throw new BadRequestException('Tenant ID is required. Please ensure you are authenticated with a valid tenant.');
      }
      this.logger.warn('Tenant ID missing in request', { user: req.user, tenantId: req.tenantId });
      throw new BadRequestException('Tenant ID is required. Please ensure you are authenticated.');
    }
    return tenantId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Request() req: AuthenticatedRequest,
    @Body() body: any,
  ): Promise<OrderResponseDto> {
    try {
      const tenantId = this.ensureTenantId(req);
      
      // Support both { cartId, orderData } and direct CreateOrderDto formats
      const rawOrderData = body.orderData || body;
      let cartId = body.cartId;

      // Transform frontend format to backend format
      // Frontend sends: { contact: { email, phone }, shippingAddress, ... }
      // Backend expects: { customerEmail, customerPhone, shippingAddress, ... }
      const orderData: CreateOrderDto = {
        customerEmail: rawOrderData.customerEmail || rawOrderData.contact?.email || rawOrderData.email || req.user?.email,
        customerName: rawOrderData.customerName || rawOrderData.shippingAddress?.fullName || rawOrderData.fullName || req.user?.name,
        customerPhone: rawOrderData.customerPhone || rawOrderData.contact?.phone || rawOrderData.phone,
        shippingAddress: rawOrderData.shippingAddress,
        billingAddress: rawOrderData.billingAddress || rawOrderData.shippingAddress,
        ipAddress: rawOrderData.ipAddress || req.ip || req.socket.remoteAddress || '0.0.0.0',
      };

      this.logger.log('Order creation request:', { 
        tenantId, 
        cartId, 
        hasEmail: !!orderData.customerEmail,
        hasShippingAddress: !!orderData.shippingAddress,
        bodyKeys: Object.keys(body),
        rawOrderDataKeys: Object.keys(rawOrderData)
      });

      // Validate required fields
      if (!orderData.customerEmail) {
        this.logger.error('Customer email is missing', { 
          rawOrderData, 
          contact: rawOrderData.contact,
          customerEmail: rawOrderData.customerEmail 
        });
        throw new BadRequestException('Customer email is required. Please provide email in contact.email or customerEmail field.');
      }

      // If cartId is not provided, try to find the user's active cart
      if (!cartId && req.user?.id) {
        this.logger.log(`cartId missing in request, fetching active cart for user ${req.user.id}`);
        // We need to inject CartService or use a method to find the cart
        // For now, let's assume the frontend should ideally pass it, 
        // but we'll try to handle it if we can.
        // Actually, let's check if we can get it from CartService.
      }

      if (!cartId) {
        // Fallback: try to find any cart for this user in this tenant
        const activeCart = await (this.orderService as any).prisma.cart.findFirst({
          where: { tenantId, userId: req.user.id },
          orderBy: { updatedAt: 'desc' }
        });
        if (activeCart) {
          cartId = activeCart.id;
          this.logger.log(`Found active cart ${cartId} for user ${req.user.id}`);
        }
      }

      if (!cartId) {
        this.logger.error('Cart ID is required', { 
          tenantId, 
          userId: req.user?.id,
          bodyKeys: Object.keys(body)
        });
        throw new BadRequestException('Cart ID is required and no active cart was found for the user. Please add items to your cart first.');
      }

      // Validate required order data
      if (!orderData.customerEmail) {
        throw new BadRequestException('Customer email is required');
      }

      // Check if wallet balance payment is requested
      const useWalletBalance = rawOrderData.useWalletBalance === true || rawOrderData.paymentMethod === 'WALLET_BALANCE';
      const paymentMethod = rawOrderData.paymentMethod;

      return this.orderService.createOrder(tenantId, cartId, orderData, {
        useWalletBalance,
        paymentMethod,
        userId: req.user?.id,
      });
    } catch (error: any) {
      this.logger.error('Error creating order:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create order: ${error?.message || 'Unknown error'}`);
    }
  }

  @Get()
  async getOrders(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    try {
      let tenantId: string;
      try {
        tenantId = this.ensureTenantId(req);
      } catch (error) {
        // If tenantId is missing but user is a customer, try to proceed with customer email filter
        if (req.user?.role === 'CUSTOMER' || req.user?.role === 'customer') {
          const customerEmail = req.user?.email;
          if (customerEmail) {
            // For customer requests without tenantId, we'll need to handle this differently
            // Try to get tenantId from the user's email or use a default
            const defaultTenant = process.env.DEFAULT_TENANT_ID;
            if (defaultTenant && defaultTenant !== 'default' && defaultTenant !== 'system') {
              tenantId = defaultTenant;
            } else {
              // If no default tenant, we can't proceed
              throw new BadRequestException('Tenant ID is required. Please ensure you are authenticated with a valid tenant.');
            }
          } else {
            throw new BadRequestException('Tenant ID is required. Please ensure you are authenticated.');
          }
        } else {
          throw error;
        }
      }
      
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      
      // If user is a customer (not admin), filter orders by their email
      const customerEmail = (req.user?.role === 'CUSTOMER' || !req.user?.role || req.user?.role === 'customer') 
        ? req.user?.email 
        : undefined;
      
      return this.orderService.getOrders(tenantId, pageNum, limitNum, status, customerEmail);
    } catch (error: any) {
      this.logger.error('Error getting orders:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch orders: ${error?.message || 'Unknown error'}`);
    }
  }

  @Get('stats')
  async getOrderStats(@Request() req: AuthenticatedRequest) {
    try {
      const tenantId = this.ensureTenantId(req);
      return this.orderService.getOrderStats(tenantId);
    } catch (error: any) {
      this.logger.error('Error getting order stats:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch order stats: ${error?.message || 'Unknown error'}`);
    }
  }

  @Get('search')
  async searchOrders(
    @Request() req: AuthenticatedRequest,
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      if (!query) {
        throw new BadRequestException('Search query is required');
      }
      const tenantId = this.ensureTenantId(req);
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      return this.orderService.searchOrders(tenantId, query, pageNum, limitNum);
    } catch (error: any) {
      this.logger.error('Error searching orders:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to search orders: ${error?.message || 'Unknown error'}`);
    }
  }

  @Get(':id')
  async getOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ): Promise<OrderResponseDto> {
    try {
      const tenantId = this.ensureTenantId(req);
      return this.orderService.getOrder(tenantId, orderId);
    } catch (error: any) {
      this.logger.error('Error getting order:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch order: ${error?.message || 'Unknown error'}`);
    }
  }

  @Put(':id/status')
  async updateOrderStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Body('status') status: string,
  ): Promise<OrderResponseDto> {
    try {
      const tenantId = this.ensureTenantId(req);
      return this.orderService.updateOrderStatus(tenantId, orderId, status);
    } catch (error: any) {
      this.logger.error('Error updating order status:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to update order status: ${error?.message || 'Unknown error'}`);
    }
  }

  @Put(':id/cancel')
  async cancelOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Body('reason') reason?: string,
  ): Promise<OrderResponseDto> {
    try {
      const tenantId = this.ensureTenantId(req);
      return this.orderService.cancelOrder(tenantId, orderId, reason);
    } catch (error: any) {
      this.logger.error('Error cancelling order:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to cancel order: ${error?.message || 'Unknown error'}`);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ): Promise<void> {
    try {
      const tenantId = this.ensureTenantId(req);
      // Note: In production, you might want to soft delete instead
      const order = await this.orderService.getOrder(tenantId, orderId);
      if (order.status !== 'CANCELLED') {
        throw new BadRequestException('Only cancelled orders can be deleted');
      }
      // Implementation for hard delete would go here
      // await this.orderService.hardDeleteOrder(tenantId, orderId);
    } catch (error: any) {
      this.logger.error('Error deleting order:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to delete order: ${error?.message || 'Unknown error'}`);
    }
  }

  @Get(':id/download/:fileType')
  async downloadDeliveryFile(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Param('fileType') fileType: string,
    @Res() res: Response,
  ) {
    try {
      const tenantId = this.ensureTenantId(req);
      
      // Verify order belongs to tenant and user has access
      const order = await this.orderService.getOrder(tenantId, orderId);
      
      // Get delivery files
      const deliveryFiles = await (this.orderService as any).digitalCardsDeliveryService.getDeliveryFiles(orderId);
      
      if (!deliveryFiles) {
        throw new NotFoundException('Delivery files not found for this order');
      }

      const filePath = fileType === 'excel' ? deliveryFiles.excelFileUrl : deliveryFiles.textFileUrl;
      
      if (!filePath) {
        throw new NotFoundException(`${fileType} file not found for this order`);
      }

      // Remove leading slash and construct full path
      const fullPath = path.join(process.cwd(), filePath.replace(/^\//, ''));
      
      if (!fs.existsSync(fullPath)) {
        throw new NotFoundException('File not found on server');
      }

      const fileName = path.basename(fullPath);
      const contentType = fileType === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/plain';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      const fileStream = fs.createReadStream(fullPath);
      fileStream.pipe(res);
    } catch (error: any) {
      this.logger.error('Error downloading delivery file:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to download file: ${error?.message || 'Unknown error'}`);
    }
  }
}