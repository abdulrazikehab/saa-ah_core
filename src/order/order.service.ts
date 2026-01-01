// apps/app-core/src/order/order.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSyncService } from '../tenant/tenant-sync.service';
import { SupplierInventoryService } from '../supplier/supplier-inventory.service';
import { CartService } from '../cart/cart.service';
import { WalletService } from '../cards/wallet.service';
import { DigitalCardsDeliveryService } from './digital-cards-delivery.service';
import { NotificationsService } from '../notifications/notifications.service';


export interface CreateOrderDto {
  customerEmail: string;
  customerName?: string;
  shippingAddress: any;
  billingAddress?: any;
  customerPhone?: string;
  ipAddress?: string;
}

export interface OrderPaymentOptions {
  useWalletBalance?: boolean;
  paymentMethod?: string;
  userId?: string;
}

export interface OrderResponseDto {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  shippingAddress: any;
  billingAddress?: any;
  notes?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
  orderItems: OrderItemDto[];
  deliveryFiles?: {
    excelFileUrl?: string;
    textFileUrl?: string;
  };
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
    private cartService: CartService,
    private walletService: WalletService,
    private digitalCardsDeliveryService: DigitalCardsDeliveryService,
    private notificationsService: NotificationsService,
  ) {}


  async createOrder(tenantId: string, cartId: string, orderData: CreateOrderDto, paymentOptions?: OrderPaymentOptions): Promise<OrderResponseDto> {
    await this.tenantSyncService.ensureTenantExists(tenantId);
    
    // Validate wallet balance BEFORE creating order if wallet payment is requested
    if (paymentOptions?.useWalletBalance && paymentOptions?.userId) {
      // Calculate cart total first to check balance
      const cart = await this.prisma.cart.findFirst({
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

      if (cart) {
        const cartTotal = await this.cartService.calculateCartTotal(cart, orderData.shippingAddress);
        const totalAmount = Number(cartTotal.total);
        
        const hasBalance = await this.walletService.hasSufficientBalance(
          paymentOptions.userId,
          totalAmount
        );

        if (!hasBalance) {
          throw new BadRequestException('رصيد المحفظة غير كافٍ لإتمام هذه العملية. يرجى شحن رصيدك أو اختيار طريقة دفع أخرى.');
        }
      }
    }
    
    // Get cart with items
    this.logger.log(`Looking for cart - cartId: ${cartId}, tenantId: ${tenantId}`);
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
      // Try to find the cart without tenant filter to provide better error message
      const cartAnyTenant = await this.prisma.cart.findFirst({
        where: { id: cartId },
        select: { id: true, tenantId: true, sessionId: true, userId: true },
      });
      if (cartAnyTenant) {
        this.logger.error(`Cart ${cartId} exists but belongs to tenant ${cartAnyTenant.tenantId}, not ${tenantId}. sessionId: ${cartAnyTenant.sessionId}, userId: ${cartAnyTenant.userId}`);
        throw new NotFoundException(`السلة غير موجودة في هذا المتجر. يرجى التأكد من أنك تستخدم نفس المتجر الذي أضفت منه المنتجات.`);
      }
      this.logger.error(`Cart ${cartId} not found in any tenant`);
      throw new NotFoundException('السلة غير موجودة');
    }

    this.logger.log(`Found cart ${cart.id} with ${cart.cartItems.length} items, tenantId: ${cart.tenantId}, sessionId: ${cart.sessionId}, userId: ${cart.userId}`);

    if (cart.cartItems.length === 0) {
      this.logger.error(`Cart ${cartId} has 0 items! tenantId: ${tenantId}`);
      throw new BadRequestException('السلة فارغة. يرجى إضافة منتجات إلى السلة قبل إتمام الطلب.');
    }

    // Prepare items for supplier validation
    const inventoryChecks: { variantId: any; currentQuantity: any; reservedQuantity: any; }[] = [];
    const itemsForValidation: { productId: string; variantId: string; quantity: number }[] = [];

    for (const item of cart.cartItems) {
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
      throw new BadRequestException('المخزون غير كافٍ. يرجى التحقق من توفر المنتج.');
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
      throw new NotFoundException('السلة غير موجودة');
    }

    // Build inventory checks with updated quantities
    for (const item of updatedCart.cartItems) {
      if (item.productVariant) {
        if (item.productVariant.inventoryQuantity < item.quantity) {
          throw new BadRequestException(
            `المخزون غير كافٍ للمنتج ${item.product.name} - ${item.productVariant.name}`
          );
        }
        inventoryChecks.push({
          variantId: item.productVariant.id,
          currentQuantity: item.productVariant.inventoryQuantity,
          reservedQuantity: item.quantity,
        });
      }
    }

    // Calculate cart total with breakdown using CartService
    const cartTotal = await this.cartService.calculateCartTotal(updatedCart, orderData.shippingAddress);
    
    // Round all amounts to 2 decimal places for precision
    const roundCurrency = (value: number): number => Math.round(value * 100) / 100;
    const subtotalAmount = roundCurrency(cartTotal.subtotal);
    const discountAmount = roundCurrency(cartTotal.discount);
    const taxAmount = roundCurrency(cartTotal.tax);
    const shippingAmount = roundCurrency(cartTotal.shipping);
    const totalAmount = roundCurrency(cartTotal.total);

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order in transaction
    const order = await this.prisma.$transaction(async (tx: any) => {
      // Update inventory for variants
      for (const check of inventoryChecks) {
        await tx.productVariant.update({
          where: { id: check.variantId },
          data: {
            inventoryQuantity: check.currentQuantity - check.reservedQuantity,
          },
        });
      }

      // Store payment method in billingAddress JSON for retrieval later (since notes field doesn't exist)
      let billingAddress = orderData.billingAddress || orderData.shippingAddress || {};
      if (typeof billingAddress === 'object' && !Array.isArray(billingAddress)) {
        billingAddress = {
          ...billingAddress,
          _paymentMethod: paymentOptions?.paymentMethod,
        };
      }

      // Create order with all breakdown fields
      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerEmail: orderData.customerEmail,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          subtotalAmount,
          discountAmount,
          taxAmount,
          shippingAmount,
          totalAmount,
          shippingAddress: orderData.shippingAddress,
          billingAddress: billingAddress,
          ipAddress: orderData.ipAddress,
          status: 'PENDING',
          paymentStatus: 'PENDING', // Will be updated to SUCCEEDED after wallet debit succeeds
        },
      });

      // Create order items
      const orderItems: any[] = [];
      for (const item of updatedCart.cartItems) {
        const price = Number(item.productVariant?.price || item.product.price);
        
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

    // Handle wallet balance payment if requested
    if (paymentOptions?.useWalletBalance && paymentOptions?.userId) {
      try {
        // Balance was already checked before order creation, but double-check as safety
        const hasBalance = await this.walletService.hasSufficientBalance(
          paymentOptions.userId,
          totalAmount
        );

        if (!hasBalance) {
          // Update order status to indicate payment failed
          await this.prisma.order.update({
            where: { id: order.order.id },
            data: {
              status: 'CANCELLED',
              paymentStatus: 'FAILED',
            },
          });
          throw new BadRequestException('رصيد المحفظة غير كافٍ لإتمام هذه العملية. يرجى شحن رصيدك أو اختيار طريقة دفع أخرى.');
        }

        // Deduct wallet balance
        await this.walletService.debit(
          paymentOptions.userId,
          totalAmount,
          `Payment for order ${orderNumber}`,
          `دفع للطلب ${orderNumber}`,
          order.order.id,
        );

        // Update order status to CONFIRMED and payment status to SUCCEEDED
        await this.prisma.order.update({
          where: { id: order.order.id },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'SUCCEEDED',
            paidAt: new Date(),
          },
        });

        this.logger.log(`Wallet balance deducted: ${totalAmount} for order ${orderNumber}`);

        // Process digital cards delivery if this is a digital cards store
        // This should happen AFTER payment is confirmed
        try {
          this.logger.log(`Processing digital cards delivery for order ${orderNumber}, tenant ${tenantId}`);
          
          const deliveryResult = await this.digitalCardsDeliveryService.processDigitalCardsDelivery(
            tenantId,
            order.order.id,
            paymentOptions.userId || null,
            order.orderItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              productName: item.productName,
            })),
          );

          if (deliveryResult) {
            this.logger.log(`✅ Digital cards delivery processed for order ${orderNumber}: ${deliveryResult.serialNumbers.length} cards, Excel: ${deliveryResult.excelFileUrl}, Text: ${deliveryResult.textFileUrl}`);
          } else {
            this.logger.warn(`⚠️ Digital cards delivery returned null for order ${orderNumber} - may not be a digital cards store or no cards available`);
          }
        } catch (error: any) {
          this.logger.error(`❌ Failed to process digital cards delivery for order ${orderNumber}:`, error);
          // Don't fail the order if digital cards delivery fails, but log the error
        }
      } catch (error: any) {
        this.logger.error(`Failed to process wallet payment for order ${orderNumber}:`, error);
        // If it's a BadRequestException (insufficient balance), rethrow it
        if (error instanceof BadRequestException) {
          throw error;
        }
        // For other errors, log but don't fail the order creation
        // Note: We can't store notes in Order model (field doesn't exist in schema)
        this.logger.warn(`Wallet payment error for order ${order.order.id}: ${error.message}`);
      }
    }

    this.logger.log(`Order ${orderNumber} created for tenant ${tenantId}`);

    // Send notification to merchant
    try {
      await this.notificationsService.sendNotification({
        tenantId,
        type: 'ORDER',
        titleEn: `New Order: ${orderNumber}`,
        titleAr: `طلب جديد: ${orderNumber}`,
        bodyEn: `A new order has been placed for ${totalAmount} SAR.`,
        bodyAr: `تم تقديم طلب جديد بمبلغ ${totalAmount} ريال سعودي.`,
        data: { orderId: order.order.id, orderNumber }
      });
    } catch (error) {
      this.logger.error(`Failed to send order notification: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Clear cart after successful order creation
    try {
      await this.cartService.clearCart(tenantId, cartId);
      this.logger.log(`Cart ${cartId} cleared after order ${orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to clear cart ${cartId} after order creation:`, error);
      // Don't fail the order if cart clearing fails
    }

    return await this.mapToOrderResponseDto(order.order, order.orderItems);

  }

  async getOrders(tenantId: string, page: number = 1, limit: number = 10, status?: string, customerEmail?: string) {
    // Coerce query parameters to numbers to avoid NaN
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { tenantId };
    if (status) {
      whereClause.status = status;
    }
    // Filter by customer email if provided (for customer-facing requests)
    if (customerEmail) {
      whereClause.customerEmail = customerEmail;
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
          paymentMethod: true,
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({
        where: whereClause,
      }),
    ]);

    const mappedOrders = await Promise.all(
      orders.map((order: { orderItems: any[]; }) => this.mapToOrderResponseDto(
        order, 
        order.orderItems
      ))
    );

    return {
      data: mappedOrders,
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
        paymentMethod: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return await this.mapToOrderResponseDto(order, order.orderItems);
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
        paymentMethod: true,
      },
    });

    this.logger.log(`Order ${order.orderNumber} status updated to ${status}`);

    // Send notification to merchant about status update
    try {
      await this.notificationsService.sendNotification({
        tenantId,
        type: 'ORDER',
        titleEn: `Order Status Updated: ${order.orderNumber}`,
        titleAr: `تحديث حالة الطلب: ${order.orderNumber}`,
        bodyEn: `Order ${order.orderNumber} is now ${status}.`,
        bodyAr: `الطلب ${order.orderNumber} الآن في حالة ${status}.`,
        data: { orderId: order.id, orderNumber: order.orderNumber, status }
      });
    } catch (error) {
      this.logger.error(`Failed to send order status notification: ${error instanceof Error ? error.message : String(error)}`);
    }

    return await this.mapToOrderResponseDto(updatedOrder, updatedOrder.orderItems);
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
    const updatedOrder = await this.prisma.$transaction(async (tx: any) => {
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
          // Note: notes field doesn't exist in Order schema, so we can't store cancellation reason
        },
        include: {
          orderItems: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          paymentMethod: true,
        },
      });
    });

    this.logger.log(`Order ${order.orderNumber} cancelled`);

    return await this.mapToOrderResponseDto(updatedOrder, updatedOrder.orderItems);
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
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
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

    const mappedOrders = await Promise.all(
      orders.map(async (order: { orderItems: any[]; }) => await this.mapToOrderResponseDto(order, order.orderItems))
    );
    
    return {
      data: mappedOrders,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Process digital cards delivery after payment success
   * Called from payment webhooks
   */
  async processDigitalCardsDeliveryAfterPayment(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: true,
        },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found for digital cards delivery`);
        return;
      }

      // Get user ID if order has a customer
      let userId: string | null = null;
      if (order.customerEmail) {
        const user = await this.prisma.user.findFirst({
          where: { email: order.customerEmail, tenantId: order.tenantId },
        });
        userId = user?.id || null;
      }

      const deliveryResult = await this.digitalCardsDeliveryService.processDigitalCardsDelivery(
        order.tenantId,
        orderId,
        userId,
        order.orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          productName: item.productName,
        })),
      );

      if (deliveryResult) {
        this.logger.log(`Digital cards delivery processed for order ${order.orderNumber}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to process digital cards delivery for order ${orderId}:`, error);
      // Don't throw - this is called from webhooks and shouldn't fail the payment
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  private async mapToOrderResponseDto(order: any, orderItems: any[]): Promise<OrderResponseDto> {
    // Extract payment method from billingAddress JSON if stored there
    let paymentMethod: string | undefined;
    let cleanBillingAddress = order.billingAddress;
    
    // Check billingAddress for stored payment method
    if (order.billingAddress && typeof order.billingAddress === 'object' && order.billingAddress._paymentMethod) {
      paymentMethod = order.billingAddress._paymentMethod;
      // Remove internal _paymentMethod field from billingAddress before returning
      const { _paymentMethod, ...rest } = order.billingAddress;
      cleanBillingAddress = rest;
    }
    
    // Also check if order has paymentMethod relation
    if (!paymentMethod && order.paymentMethod) {
      paymentMethod = order.paymentMethod.provider || order.paymentMethod.name;
    }

    // Get delivery files for digital cards orders
    let deliveryFiles: { excelFileUrl?: string; textFileUrl?: string } | undefined;
    try {
      const files = await this.digitalCardsDeliveryService.getDeliveryFiles(order.id);
      deliveryFiles = files || undefined;
    } catch (error) {
      this.logger.warn(`Failed to get delivery files for order ${order.id}:`, error);
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      paymentMethod,
      paymentStatus: order.paymentStatus || 'PENDING',
      shippingAddress: order.shippingAddress,
      billingAddress: cleanBillingAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderItems: orderItems.map(item => ({
        id: item.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.price) * item.quantity,
      })),
      deliveryFiles,
    };
  }
}