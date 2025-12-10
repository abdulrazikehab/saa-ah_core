import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface PaymentSettings {
  hyperPayEnabled: boolean;
  hyperPayEntityId?: string;
  hyperPayAccessToken?: string;
  hyperPayTestMode: boolean;
  hyperPayCurrency: string;
}

@Injectable()
export class HyperPayService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a checkout session with HyperPay
   */
  async createCheckout(settings: PaymentSettings, orderData: any) {
    if (!settings.hyperPayEnabled) {
      throw new Error('HyperPay is not enabled');
    }

    if (!settings.hyperPayEntityId || !settings.hyperPayAccessToken) {
      throw new Error('HyperPay credentials not configured');
    }

    const baseUrl = settings.hyperPayTestMode
      ? 'https://test.oppwa.com'
      : 'https://oppwa.com';

    try {
      const params: Record<string, string> = {
        entityId: settings.hyperPayEntityId,
        amount: orderData.amount.toFixed(2),
        currency: settings.hyperPayCurrency,
        paymentType: 'DB',
        merchantTransactionId: orderData.orderNumber,
      };

      // Add customer info if available
      if (orderData.customerEmail) {
        params['customer.email'] = orderData.customerEmail;
      }
      if (orderData.customerName) {
        params['customer.givenName'] = orderData.customerName;
      }

      // Add billing address if available
      if (orderData.billingAddress) {
        params['billing.street1'] = orderData.billingAddress.street || '';
        params['billing.city'] = orderData.billingAddress.city || '';
        params['billing.country'] = orderData.billingAddress.country || 'SA';
      }

      // Add shipping address if available
      if (orderData.shippingAddress) {
        params['shipping.street1'] = orderData.shippingAddress.street || '';
        params['shipping.city'] = orderData.shippingAddress.city || '';
        params['shipping.country'] = orderData.shippingAddress.country || 'SA';
      }

      const response = await fetch(`${baseUrl}/v1/checkouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.hyperPayAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.result?.description || 'Checkout creation failed');
      }

      const data = await response.json();
      
      return {
        checkoutId: data.id,
        redirectUrl: `${baseUrl}/v1/paymentWidgets.js?checkoutId=${data.id}`,
      };
    } catch (error: any) {
      throw new Error(`HyperPay checkout failed: ${error.message}`);
    }
  }

  /**
   * Get payment status from HyperPay
   */
  async getPaymentStatus(settings: PaymentSettings, checkoutId: string) {
    const baseUrl = settings.hyperPayTestMode
      ? 'https://test.oppwa.com'
      : 'https://oppwa.com';

    try {
      const response = await fetch(
        `${baseUrl}/v1/checkouts/${checkoutId}/payment?entityId=${settings.hyperPayEntityId}`,
        {
          headers: {
            'Authorization': `Bearer ${settings.hyperPayAccessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get payment status');
      }

      const data = await response.json();
      
      // Check if payment was successful
      const isSuccess = /^(000\.000\.|000\.100\.1|000\.[36])/.test(data.result.code);
      
      return {
        success: isSuccess,
        status: data.result.code,
        description: data.result.description,
        transactionId: data.id,
        amount: data.amount,
        currency: data.currency,
      };
    } catch (error: any) {
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  /**
   * Process HyperPay webhook
   */
  async processWebhook(data: any) {
    const checkoutId = data.id;
    const status = data.result.code;
    
    // Find order by checkout ID
    const order = await this.prisma.order.findFirst({
      where: { transactionId: checkoutId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Update order status based on payment result
    const isSuccess = /^(000\.000\.|000\.100\.1|000\.[36])/.test(status);
    
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isSuccess ? 'SUCCEEDED' : 'FAILED',
        status: isSuccess ? 'CONFIRMED' : 'CANCELLED',
        paidAt: isSuccess ? new Date() : null,
      },
    });

    return { success: isSuccess };
  }

  /**
   * Refund a payment
   */
  async refundPayment(settings: PaymentSettings, transactionId: string, amount?: number) {
    const baseUrl = settings.hyperPayTestMode
      ? 'https://test.oppwa.com'
      : 'https://oppwa.com';

    try {
      const params: Record<string, string> = {
        entityId: settings.hyperPayEntityId!,
        currency: settings.hyperPayCurrency,
        paymentType: 'RF',
      };

      if (amount) {
        params.amount = amount.toFixed(2);
      }

      const response = await fetch(`${baseUrl}/v1/payments/${transactionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.hyperPayAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.result?.description || 'Refund failed');
      }

      const data = await response.json();
      
      return {
        success: true,
        refundId: data.id,
        amount: data.amount,
      };
    } catch (error: any) {
      throw new Error(`Refund failed: ${error.message}`);
    }
  }
}
