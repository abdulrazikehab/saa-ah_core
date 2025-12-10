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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderService, CreateOrderDto, OrderResponseDto } from './order.service';
import { AuthenticatedRequest } from '../types/request.types';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  private ensureTenantId(tenantId: string | undefined): string {
    // Use provided tenantId, or fall back to default
    return tenantId || process.env.DEFAULT_TENANT_ID || 'default';
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Request() req: AuthenticatedRequest,
    @Body() body: { cartId: string; orderData: CreateOrderDto },
  ): Promise<OrderResponseDto> {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.orderService.createOrder(tenantId, body.cartId, body.orderData);
  }

  @Get()
  async getOrders(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.ensureTenantId(req.tenantId);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.orderService.getOrders(tenantId, pageNum, limitNum, status);
  }

  @Get('stats')
  async getOrderStats(@Request() req: AuthenticatedRequest) {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.orderService.getOrderStats(tenantId);
  }

  @Get('search')
  async searchOrders(
    @Request() req: AuthenticatedRequest,
    @Query('q') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      throw new Error('Search query is required');
    }
    const tenantId = this.ensureTenantId(req.tenantId);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.orderService.searchOrders(tenantId, query, pageNum, limitNum);
  }

  @Get(':id')
  async getOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ): Promise<OrderResponseDto> {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.orderService.getOrder(tenantId, orderId);
  }

  @Put(':id/status')
  async updateOrderStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Body('status') status: string,
  ): Promise<OrderResponseDto> {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.orderService.updateOrderStatus(tenantId, orderId, status);
  }

  @Put(':id/cancel')
  async cancelOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
    @Body('reason') reason?: string,
  ): Promise<OrderResponseDto> {
    const tenantId = this.ensureTenantId(req.tenantId);
    return this.orderService.cancelOrder(tenantId, orderId, reason);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrder(
    @Request() req: AuthenticatedRequest,
    @Param('id') orderId: string,
  ): Promise<void> {
    const tenantId = this.ensureTenantId(req.tenantId);
    // Note: In production, you might want to soft delete instead
    const order = await this.orderService.getOrder(tenantId, orderId);
    if (order.status !== 'CANCELLED') {
      throw new Error('Only cancelled orders can be deleted');
    }
    // Implementation for hard delete would go here
    // await this.orderService.hardDeleteOrder(tenantId, orderId);
  }
}