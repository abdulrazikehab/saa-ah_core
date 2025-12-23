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
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService, CreateOrderDto, OrderResponseDto } from './order.service';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  private ensureTenantId(req: AuthenticatedRequest): string {
    // Try multiple sources for tenantId: user object (JWT), middleware, or user id
    const tenantId = req.user?.tenantId || req.tenantId || req.user?.id;
    if (!tenantId) {
      this.logger.warn('Tenant ID missing in request', { user: req.user, tenantId: req.tenantId });
      throw new BadRequestException('Tenant ID is required. Please ensure you are authenticated.');
    }
    return tenantId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Request() req: AuthenticatedRequest,
    @Body() body: { cartId: string; orderData: CreateOrderDto },
  ): Promise<OrderResponseDto> {
    try {
      const tenantId = this.ensureTenantId(req);
      return this.orderService.createOrder(tenantId, body.cartId, body.orderData);
    } catch (error: any) {
      this.logger.error('Error creating order:', error);
      if (error instanceof BadRequestException) {
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
      const tenantId = this.ensureTenantId(req);
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      return this.orderService.getOrders(tenantId, pageNum, limitNum, status);
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
}