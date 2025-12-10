import { Injectable, Logger, NotFoundException, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CouponService } from '../coupon/coupon.service';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(RedisService) private redisService?: RedisService,
    @Optional() private couponService?: CouponService,
  ) {}

  async getOrCreateCart(tenantId: string, sessionId?: string, userId?: string) {
    // Try Redis cache first if available
    if (this.redisService && sessionId) {
      const cachedCart = await this.redisService.getCartSession(sessionId);
      if (cachedCart) {
        this.logger.log(`Retrieved cart from Redis cache: ${sessionId}`);
        return cachedCart;
      }
    }

    let cart;

    // Try to find existing cart in database
    if (userId) {
      cart = await this.prisma.cart.findFirst({
        where: { tenantId, userId },
        include: { 
          cartItems: { 
            include: { 
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 1 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
    } else if (sessionId) {
      cart = await this.prisma.cart.findFirst({
        where: { tenantId, sessionId },
        include: { 
          cartItems: { 
            include: { 
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 1 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
    }

    // Create new cart if not found
    if (!cart) {
      console.log('🛒 Creating new cart for tenant:', tenantId);
      // Verify tenant exists first
      const tenantExists = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenantExists) {
        console.error(`❌ Tenant ${tenantId} does not exist! Cannot create cart.`);
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      cart = await this.prisma.cart.create({
        data: {
          tenantId,
          sessionId,
          userId,
        },
        include: { 
          cartItems: { 
            include: { 
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 1 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
    }

    // Cache in Redis if available
    if (this.redisService && sessionId) {
      await this.redisService.setCartSession(sessionId, cart);
      this.logger.log(`Cached cart in Redis: ${sessionId}`);
    }

    return cart;
  }

  async addToCart(
    tenantId: string,
    cartId: string,
    productId: string,
    quantity: number,
    productVariantId?: string,
  ) {
    // Verify product exists and belongs to tenant
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { variants: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify variant exists if provided
    let selectedVariant = null;
    if (productVariantId) {
      selectedVariant = product.variants.find((v: { id: string; }) => v.id === productVariantId);
      if (!selectedVariant) {
        throw new NotFoundException('Product variant not found');
      }
      
      // Check inventory
      if (selectedVariant.inventoryQuantity < quantity) {
        throw new BadRequestException(`Insufficient inventory. Only ${selectedVariant.inventoryQuantity} available`);
      }
    } else if (product.variants.length > 0) {
      throw new BadRequestException('Product variant is required for this product');
    }

    // Check if item already in cart
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
        productVariantId: productVariantId || null,
      },
    });

    let cartItem;
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      
      // Check inventory again for updated quantity
      if (selectedVariant && selectedVariant.inventoryQuantity < newQuantity) {
        throw new BadRequestException(`Insufficient inventory. Cannot add ${quantity} more. Only ${selectedVariant.inventoryQuantity - existingItem.quantity} available`);
      }

      // Update quantity
      cartItem = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: { 
          product: {
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 }
            }
          }, 
          productVariant: true 
        },
      });
    } else {
      // Create new cart item
      cartItem = await this.prisma.cartItem.create({
        data: {
          cartId,
          productId,
          productVariantId,
          quantity,
        },
        include: { 
          product: {
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 1 }
            }
          }, 
          productVariant: true 
        },
      });
    }

    this.logger.log(`Added product ${productId} to cart ${cartId}`);

    // Clear Redis cache
    const cart = await this.getCartById(tenantId, cartId);
    if (this.redisService && cart.sessionId) {
      await this.redisService.deleteCartSession(cart.sessionId);
    }

    return cart;
  }

  async updateCartItem(
    tenantId: string,
    cartId: string,
    itemId: string,
    quantity: number,
  ) {
    if (quantity <= 0) {
      return this.removeFromCart(tenantId, cartId, itemId);
    }

    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { id: cartId, tenantId },
      },
      include: { productVariant: true },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Check inventory if variant exists
    if (cartItem.productVariant && cartItem.productVariant.inventoryQuantity < quantity) {
      throw new BadRequestException(`Insufficient inventory. Only ${cartItem.productVariant.inventoryQuantity} available`);
    }

    const updatedItem = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: { 
        product: {
          include: {
            images: { orderBy: { sortOrder: 'asc' }, take: 1 }
          }
        }, 
        productVariant: true 
      },
    });

    this.logger.log(`Updated cart item ${itemId} quantity to ${quantity}`);

    // Clear Redis cache
    const cart = await this.getCartById(tenantId, cartId);
    if (this.redisService && cart.sessionId) {
      await this.redisService.deleteCartSession(cart.sessionId);
    }

    return cart;
  }

  async removeFromCart(tenantId: string, cartId: string, itemId: string) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { id: cartId, tenantId },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    this.logger.log(`Removed cart item ${itemId} from cart ${cartId}`);

    // Clear Redis cache
    const cart = await this.getCartById(tenantId, cartId);
    if (this.redisService && cart.sessionId) {
      await this.redisService.deleteCartSession(cart.sessionId);
    }

    return cart;
  }

  async clearCart(tenantId: string, cartId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, tenantId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await this.prisma.cartItem.deleteMany({
      where: {
        cart: { id: cartId, tenantId },
      },
    });

    this.logger.log(`Cleared all items from cart ${cartId}`);

    // Clear Redis cache
    if (this.redisService && cart.sessionId) {
      await this.redisService.deleteCartSession(cart.sessionId);
    }

    return this.getCartById(tenantId, cartId);
  }

  async getCartById(tenantId: string, cartId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, tenantId },
      include: {
        cartItems: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: 'asc' }, take: 1 }
              }
            },
            productVariant: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  async calculateCartTotal(cart: any) {
    let subtotal = 0;
    
    for (const item of cart.cartItems) {
      const price = item.productVariant?.price || item.product.price;
      subtotal += Number(price) * item.quantity;
    }

    let discountAmount = 0;
    let shippingAmount = subtotal > 100 ? 0 : 10; // Default logic

    if (cart.couponCode && this.couponService) {
      try {
        const coupon = await this.couponService.validate(cart.tenantId, cart.couponCode, subtotal);
        discountAmount = this.couponService.calculateDiscount(coupon, subtotal);
        
        if (coupon.type === 'FREE_SHIPPING') {
          shippingAmount = 0;
        }
      } catch (error: any) {
        this.logger.warn(`Invalid coupon code ${cart.couponCode}: ${error.message}`);
        // Optionally remove invalid coupon from cart
      }
    }

    const taxAmount = (subtotal - discountAmount) * 0.15; // 15% tax example
    const total = subtotal - discountAmount + taxAmount + shippingAmount;

    return {
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      shipping: shippingAmount,
      total,
    };
  }

  async mergeCarts(tenantId: string, sessionCartId: string, userCartId: string) {
    const sessionCart = await this.getCartById(tenantId, sessionCartId);
    const userCart = await this.getCartById(tenantId, userCartId);

    // Move all items from session cart to user cart
    for (const item of sessionCart.cartItems) {
      try {
        await this.addToCart(
          tenantId,
          userCart.id,
          item.productId,
          item.quantity,
          item.productVariantId
        );
      } catch (error) {
        this.logger.warn(`Failed to merge cart item: ${error}`);
      }
    }

    // Delete session cart
    await this.prisma.cart.delete({
      where: { id: sessionCartId },
    });

    // Clear Redis cache
    if (this.redisService) {
      await this.redisService.deleteCartSession(sessionCart.sessionId);
    }

    return this.getCartById(tenantId, userCartId);
  }
}