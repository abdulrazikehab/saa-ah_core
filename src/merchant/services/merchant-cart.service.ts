import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CardProductService } from '../../cards/card-product.service';
import { AddCartItemDto, UpdateCartItemDto, CartResponse } from '../dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MerchantCartService {
  private readonly logger = new Logger(MerchantCartService.name);

  constructor(
    private prisma: PrismaService,
    private cardProductService: CardProductService,
  ) {}

  // Get or create cart for merchant/employee
  async getOrCreateCart(merchantId: string, employeeId?: string) {
    let cart = await this.prisma.merchantCart.findFirst({
      where: { merchantId, employeeId: employeeId || null },
    });

    if (!cart) {
      cart = await this.prisma.merchantCart.create({
        data: {
          merchantId,
          employeeId,
          currency: 'SAR',
        },
      });
    }

    return cart;
  }

  // Get cart with full details
  async getCart(merchantId: string, tenantId: string, employeeId?: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(merchantId, employeeId);

    const cartWithItems = await this.prisma.merchantCart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              include: { brand: true },
            },
          },
        },
      },
    });

    if (!cartWithItems) {
      throw new NotFoundException('Cart not found');
    }

    // Calculate totals and build response
    let subtotal = new Decimal(0);
    let discountTotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const items = cartWithItems.items.map((item) => {
      const product = item.product;
      const effectivePrice = new Decimal(product.wholesalePrice);
      const lineTotal = effectivePrice.times(item.quantity);
      const lineTax = lineTotal.times(product.taxRate);

      subtotal = subtotal.plus(lineTotal);
      taxTotal = taxTotal.plus(lineTax);

      return {
        id: item.id,
        productId: product.id,
        productName: product.name,
        productNameAr: product.nameAr,
        productImage: product.image,
        qty: item.quantity,
        effectiveUnitPrice: effectivePrice.toNumber(),
        lineTotal: lineTotal.toNumber(),
        minQty: product.minQuantity,
        maxQty: product.maxQuantity,
        availableStock: product.stockCount,
        metadata: item.metadata,
      };
    });

    const total = subtotal.minus(discountTotal).plus(taxTotal);

    return {
      cartId: cart.id,
      currency: cart.currency,
      items,
      totals: {
        subtotal: subtotal.toNumber(),
        discountTotal: discountTotal.toNumber(),
        feesTotal: 0,
        taxTotal: taxTotal.toNumber(),
        total: total.toNumber(),
      },
    };
  }

  // Add or update cart item
  async addItem(merchantId: string, tenantId: string, dto: AddCartItemDto, employeeId?: string) {
    const cart = await this.getOrCreateCart(merchantId, employeeId);

    // Validate product
    const product = await this.cardProductService.findOne(tenantId, dto.productId);

    if (!product.isActive || !product.isAvailable) {
      throw new BadRequestException('Product is not available');
    }

    // If qty is 0, remove the item
    if (dto.qty === 0) {
      await this.prisma.merchantCartItem.deleteMany({
        where: { cartId: cart.id, productId: dto.productId },
      });
      return this.getCart(merchantId, tenantId, employeeId);
    }

    // Validate quantity
    if (dto.qty < product.minQuantity) {
      throw new BadRequestException(`Minimum quantity is ${product.minQuantity}`);
    }
    if (dto.qty > product.maxQuantity) {
      throw new BadRequestException(`Maximum quantity is ${product.maxQuantity}`);
    }
    if (dto.qty > product.availableStock) {
      throw new BadRequestException(`Only ${product.availableStock} items available`);
    }

    // Upsert cart item
    await this.prisma.merchantCartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      update: {
        quantity: dto.qty,
        metadata: dto.metadata as any,
        unitPriceSnapshot: product.wholesalePrice,
      },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.qty,
        metadata: dto.metadata as any,
        unitPriceSnapshot: product.wholesalePrice,
      },
    });

    this.logger.log(`Updated cart ${cart.id} - product ${dto.productId} qty ${dto.qty}`);

    return this.getCart(merchantId, tenantId, employeeId);
  }

  // Update cart item quantity
  async updateItem(merchantId: string, tenantId: string, itemId: string, dto: UpdateCartItemDto, employeeId?: string) {
    const cart = await this.getOrCreateCart(merchantId, employeeId);

    const item = await this.prisma.merchantCartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    // If qty is 0, remove the item
    if (dto.qty === 0) {
      await this.prisma.merchantCartItem.delete({
        where: { id: itemId },
      });
      return this.getCart(merchantId, tenantId, employeeId);
    }

    // Validate quantity
    if (dto.qty < item.product.minQuantity) {
      throw new BadRequestException(`Minimum quantity is ${item.product.minQuantity}`);
    }
    if (dto.qty > item.product.maxQuantity) {
      throw new BadRequestException(`Maximum quantity is ${item.product.maxQuantity}`);
    }
    if (dto.qty > item.product.stockCount) {
      throw new BadRequestException(`Only ${item.product.stockCount} items available`);
    }

    await this.prisma.merchantCartItem.update({
      where: { id: itemId },
      data: { quantity: dto.qty },
    });

    return this.getCart(merchantId, tenantId, employeeId);
  }

  // Remove cart item
  async removeItem(merchantId: string, tenantId: string, itemId: string, employeeId?: string) {
    const cart = await this.getOrCreateCart(merchantId, employeeId);

    const item = await this.prisma.merchantCartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.merchantCartItem.delete({
      where: { id: itemId },
    });

    return this.getCart(merchantId, tenantId, employeeId);
  }

  // Clear cart
  async clearCart(merchantId: string, tenantId: string, employeeId?: string) {
    const cart = await this.getOrCreateCart(merchantId, employeeId);

    await this.prisma.merchantCartItem.deleteMany({
      where: { cartId: cart.id },
    });

    this.logger.log(`Cleared cart ${cart.id}`);

    return { ok: true };
  }

  // Get cart items for order creation
  async getCartItemsForOrder(cartId: string, tenantId: string) {
    const cart = await this.prisma.merchantCart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }
}

