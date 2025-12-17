// apps/app-core/src/order/order.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSyncService } from '../tenant/tenant-sync.service';
import { SupplierInventoryService } from '../supplier/supplier-inventory.service';

export interface CreateOrderDto {
  customerEmail: string;
  customerName?: string;
  shippingAddress: any;
  billingAddress?: any;
  customerPhone?: string;
  notes?: string;
  ipAddress?: string;
}

export interface OrderResponseDto {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  status: string;
  shippingAddress: any;
  billingAddress?: any;
  notes?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
  orderItems: OrderItemDto[];
}

export interface OrderItemDto {
  id: string;
  productId: string;
  productVariantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  price: number;
  total: number;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private tenantSyncService: TenantSyncService,
    private supplierInventoryService: SupplierInventoryService,
  ) {}

  async createOrder(tenantId: string, cartId: string, orderData: CreateOrderDto): Promise<OrderResponseDto> {
    await this.tenantSyncService.ensureTenantExists(tenantId);
    // Get cart with items
    const cart = await this.prisma.cart.findFirst({
      where: {
        id: cartId,
        tenantId,
      },
      include: {
        cartItems: {
          include: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    if (cart.cartItems.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Calculate total and validate inventory with supplier sync
    let totalAmount = 0;
    const inventoryChecks: { variantId: any; currentQuantity: any; reservedQuantity: any; }[] = [];
    const itemsForValidation: { productId: string; variantId: string; quantity: number }[] = [];

    for (const item of cart.cartItems) {
      const price = item.productVariant?.price || item.product.price;
      const itemTotal = price * item.quantity;
      totalAmount += itemTotal;

      // Prepare items for supplier validation
      if (item.productVariant) {
        itemsForValidation.push({
          productId: item.product.id,
          variantId: item.productVariant.id,
          quantity: item.quantity,
        });
      }
    }

    // Validate inventory with supplier sync
    const inventoryValid = await this.supplierInventoryService.validateInventoryBeforeOrder(
      tenantId,
      itemsForValidation
    );

    if (!inventoryValid) {
      throw new BadRequestException('Insufficient inventory. Please check product availability.');
    }

    // Re-fetch cart items after potential supplier sync
    const updatedCart = await this.prisma.cart.findFirst({
      where: { id: cartId, tenantId },
      include: {
        cartItems: {
          include: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    if (!updatedCart) {
      throw new NotFoundException('Cart not found');
    }

    // Build inventory checks with updated quantities
    for (const item of updatedCart.cartItems) {
      if (item.productVariant) {
        if (item.productVariant.inventoryQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient inventory for ${item.product.name} - ${item.productVariant.name}`
          );
        }
        inventoryChecks.push({
          variantId: item.productVariant.id,
          currentQuantity: item.productVariant.inventoryQuantity,
          reservedQuantity: item.quantity,
        });
      }
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order in transaction
    const order = await this.prisma.$transaction(async (tx: { productVariant: { update: (arg0: { where: { id: any; }; data: { inventoryQuantity: number; }; }) => any; }; order: { create: (arg0: { data: { tenantId: string; orderNumber: string; customerEmail: string; customerName: string | undefined; customerPhone: string | undefined; totalAmount: number; shippingAddress: any; billingAddress: any; notes: string | undefined; ipAddress: string | undefined; status: string; }; }) => any; }; orderItem: { create: (arg0: { data: { orderId: any; productId: any; productVariantId: any; quantity: any; price: any; productName: any; variantName: any; }; }) => any; }; cartItem: { deleteMany: (arg0: { where: { cartId: string; }; }) => any; }; }) => {
      // Update inventory for variants
      for (const check of inventoryChecks) {
        await tx.productVariant.update({
          where: { id: check.variantId },
          data: {
            inventoryQuantity: check.currentQuantity - check.reservedQuantity,
          },
        });
      }

      // Create order
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          totalAmount,
          shippingAddress: orderData.shippingAddress,
          billingAddress: orderData.billingAddress || orderData.shippingAddress,
          notes: orderData.notes,
          ipAddress: orderData.ipAddress,
          status: 'PENDING',
        },
      });

      // Create order items
      const orderItems: any[] = [];
      for (const item of cart.cartItems) {
        const price = item.productVariant?.price || item.product.price;
        
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.product.id,
            productVariantId: item.productVariant?.id,
            quantity: item.quantity,
            price,
            productName: item.product.name,
            variantName: item.productVariant?.name,
          },
        });
        orderItems.push(orderItem);
      }

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId },
      });

      return { order, orderItems };
    });

    this.logger.log(`Order ${orderNumber} created for tenant ${tenantId}`);

    return this.mapToOrderResponseDto(order.order, order.orderItems);
  }

  async getOrders(tenantId: string, page: number = 1, limit: number = 10, status?: string) {
    // Coerce query parameters to numbers to avoid NaN
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { tenantId };
    if (status) {
      whereClause.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          orderItems: {
            include: {
              product: true,
              productVariant: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({
        where: whereClause,
      }),
    ]);

    return {
      data: orders.map((order: { orderItems: any[]; }) => this.mapToOrderResponseDto(
        order, 
        order.orderItems
      )),
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    };
  }

  async getOrder(tenantId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        orderItems: {
          include: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.mapToOrderResponseDto(order, order.orderItems);
  }

  async updateOrderStatus(tenantId: string, orderId: string, status: string): Promise<OrderResponseDto> {
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid order status');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        orderItems: {
          include: {
            product: true,
            productVariant: true,
          },
        },
      },
    });

    this.logger.log(`Order ${order.orderNumber} status updated to ${status}`);

    return this.mapToOrderResponseDto(updatedOrder, updatedOrder.orderItems);
  }

  async cancelOrder(tenantId: string, orderId: string, reason?: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        orderItems: {
          include: {
            productVariant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
      throw new BadRequestException('Cannot cancel shipped or delivered orders');
    }

    // Restore inventory in transaction
    const updatedOrder = await this.prisma.$transaction(async (tx: { productVariant: { update: (arg0: { where: { id: any; }; data: { inventoryQuantity: { increment: any; }; }; }) => any; }; order: { update: (arg0: { where: { id: string; }; data: { status: string; notes: any; }; include: { orderItems: { include: { product: boolean; productVariant: boolean; }; }; }; }) => any; }; }) => {
      // Restore inventory for variants
      for (const item of order.orderItems) {
        if (item.productVariant) {
          await tx.productVariant.update({
            where: { id: item.productVariant.id },
            data: {
              inventoryQuantity: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      // Update order status
      return tx.order.update({
        where: { id: orderId },
        data: { 
          status: 'CANCELLED',
          notes: reason ? `${order.notes || ''}\nCancelled: ${reason}`.trim() : order.notes,
        },
        include: {
          orderItems: {
            include: {
              product: true,
              productVariant: true,
            },
          },
        },
      });
    });

    this.logger.log(`Order ${order.orderNumber} cancelled`);

    return this.mapToOrderResponseDto(updatedOrder, updatedOrder.orderItems);
  }

  async getOrderStats(tenantId: string) {
    const [
      totalOrders,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      todayOrders,
      weekOrders,
    ] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.order.count({ where: { tenantId, status: 'CONFIRMED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'PROCESSING' } }),
      this.prisma.order.count({ where: { tenantId, status: 'SHIPPED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { tenantId, status: 'CANCELLED' } }),
      this.prisma.order.aggregate({
        where: { tenantId, status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalOrders,
      statusBreakdown: {
        pending: pendingOrders,
        confirmed: confirmedOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      recentActivity: {
        today: todayOrders,
        last7Days: weekOrders,
      },
    };
  }

  async searchOrders(tenantId: string, query: string, page: number = 1, limit: number = 10) {
    // Coerce query parameters to numbers to avoid NaN
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { customerEmail: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: {
          orderItems: {
            include: {
              product: true,
              productVariant: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({
        where: {
          tenantId,
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { customerEmail: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return {
      data: orders.map((order: { orderItems: any[]; }) => this.mapToOrderResponseDto(order, order.orderItems)),
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    };
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  private mapToOrderResponseDto(order: any, orderItems: any[]): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: order.totalAmount,
      status: order.status,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItems: orderItems.map(item => ({
        id: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
      })),
    };
  }
}