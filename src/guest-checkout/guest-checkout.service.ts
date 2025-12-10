import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuestCheckoutService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create an order for a guest user (no authentication required)
   */
  async createGuestOrder(tenantId: string, orderData: any) {
    // Validate guest information
    if (!orderData.guestEmail) {
      throw new Error('Guest email is required');
    }

    // Check checkout settings from Tenant settings
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    const settings = (tenant?.settings as any)?.checkout || {
      allowGuestCheckout: true,
      requireEmailForGuests: true,
      requirePhoneForGuests: true,
    };

    if (!settings.allowGuestCheckout) {
      throw new Error('Guest checkout is not enabled for this store');
    }

    if (settings.requireEmailForGuests && !orderData.guestEmail) {
      throw new Error('Email is required for guest checkout');
    }

    if (settings.requirePhoneForGuests && !orderData.guestPhone) {
      throw new Error('Phone number is required for guest checkout');
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber(tenantId);

    // Create the order
    const order = await this.prisma.order.create({
      data: {
        tenantId,
        orderNumber,
        isGuest: true,
        guestEmail: orderData.guestEmail,
        guestName: orderData.guestName,
        guestPhone: orderData.guestPhone,
        customerEmail: orderData.guestEmail, // For compatibility
        customerName: orderData.guestName,
        customerPhone: orderData.guestPhone,
        totalAmount: orderData.totalAmount,
        subtotalAmount: orderData.subtotalAmount,
        taxAmount: orderData.taxAmount || 0,
        shippingAmount: orderData.shippingAmount || 0,
        discountAmount: orderData.discountAmount || 0,
        shippingAddress: orderData.shippingAddress,
        billingAddress: orderData.billingAddress,
        ipAddress: orderData.ipAddress,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        shippingStatus: 'UNFULFILLED',
        orderItems: {
          create: orderData.items.map((item: any) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            price: item.price,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
          })),
        },
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

    // Send order confirmation email to guest
    await this.sendGuestOrderConfirmation(order);

    return order;
  }

  /**
   * Get guest order by order number and email (for order tracking)
   */
  async getGuestOrder(orderNumber: string, email: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        guestEmail: email,
        isGuest: true,
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
      throw new Error('Order not found or email does not match');
    }

    return order;
  }

  /**
   * Get checkout settings for a tenant
   */
  async getCheckoutSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    const settings = (tenant?.settings as any)?.checkout || {
      allowGuestCheckout: true,
      requireEmailForGuests: true,
      requirePhoneForGuests: true,
      forceAccountCreation: false,
      requireEmailVerification: false,
      requirePhoneVerification: false,
      requireIdVerification: false,
      idVerificationThreshold: 1000,
    };

    return settings;
  }

  /**
   * Update checkout settings
   */
  async updateCheckoutSettings(tenantId: string, settings: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    const currentSettings = (tenant?.settings as any) || {};
    const newSettings = {
      ...currentSettings,
      checkout: {
        ...(currentSettings.checkout || {}),
        ...settings
      }
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: newSettings }
    });

    return newSettings.checkout;
  }

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.order.count({
      where: { tenantId },
    });
    const orderNumber = `ORD-${Date.now()}-${count + 1}`;
    return orderNumber;
  }

  private async sendGuestOrderConfirmation(order: any) {
    // TODO: Implement email sending
    // This will use the email integration service
    console.log(`📧 Sending order confirmation to ${order.guestEmail}`);
    console.log(`Order #${order.orderNumber} - Total: ${order.totalAmount}`);
  }
}
