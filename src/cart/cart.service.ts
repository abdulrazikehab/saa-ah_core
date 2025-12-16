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
    this.logger.log(`getOrCreateCart called - tenantId: ${tenantId}, sessionId: ${sessionId || 'none'}, userId: ${userId || 'none'}`);
    
    // Try Redis cache first if available
    if (this.redisService && sessionId) {
      const cachedCart = await this.redisService.getCartSession(sessionId);
      if (cachedCart) {
        this.logger.log(`Retrieved cart from Redis cache: ${sessionId}, items: ${cachedCart.cartItems?.length || 0}`);
        return cachedCart;
      }
    }

    let cart;

    // Try to find existing cart in database
    // Priority: 1. userId + sessionId (most specific), 2. userId only, 3. sessionId only
    if (userId && sessionId) {
      // First try to find cart with both userId and sessionId
      cart = await this.prisma.cart.findFirst({
        where: { tenantId, userId, sessionId },
        include: { 
          cartItems: { 
            include: { 
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 10 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
      this.logger.log(`Cart search by userId+sessionId: ${cart ? `found (${cart.cartItems?.length || 0} items)` : 'not found'}`);
    }
    
    if (!cart && userId) {
      // If not found, try by userId only
      cart = await this.prisma.cart.findFirst({
        where: { tenantId, userId },
        include: { 
          cartItems: { 
            include: { 
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 10 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
      this.logger.log(`Cart search by userId only: ${cart ? `found (${cart.cartItems?.length || 0} items)` : 'not found'}`);
      
      // If found by userId but sessionId is different, update it
      if (cart && sessionId && cart.sessionId !== sessionId) {
        this.logger.log(`Updating cart sessionId from ${cart.sessionId} to ${sessionId}`);
        cart = await this.prisma.cart.update({
          where: { id: cart.id },
          data: { sessionId },
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
    }
    
    if (!cart && sessionId) {
      // If still not found, try by sessionId only
      cart = await this.prisma.cart.findFirst({
        where: { tenantId, sessionId },
        include: { 
          cartItems: { 
            include: { 
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 10 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
      this.logger.log(`Cart search by sessionId only: ${cart ? `found (${cart.cartItems?.length || 0} items)` : 'not found'}`);
      
      // If found by sessionId but userId is different, update it
      if (cart && userId && cart.userId !== userId) {
        this.logger.log(`Updating cart userId from ${cart.userId} to ${userId}`);
        cart = await this.prisma.cart.update({
          where: { id: cart.id },
          data: { userId },
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
                  images: { orderBy: { sortOrder: 'asc' }, take: 10 }
                }
              }, 
              productVariant: true 
            } 
          } 
        },
      });
    }

    // Ensure cartItems is always an array (even if empty)
    if (!cart.cartItems) {
      cart.cartItems = [];
    }
    
    this.logger.log(`Returning cart - cartId: ${cart.id}, items: ${cart.cartItems.length}, sessionId: ${cart.sessionId || sessionId}, userId: ${cart.userId || userId}`);
    
    // Cache in Redis if available
    if (this.redisService && (cart.sessionId || sessionId)) {
      const cacheSessionId = cart.sessionId || sessionId;
      await this.redisService.setCartSession(cacheSessionId, cart);
      this.logger.log(`Cached cart in Redis: ${cacheSessionId}, items: ${cart.cartItems.length}`);
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

    // Verify variant exists if provided, or auto-select first variant if product has variants
    let selectedVariant: { id: string; inventoryQuantity: number; trackInventory: boolean } | null = null;
    let finalVariantId = productVariantId;
    
    // If product has variants but no variantId provided, use the first variant automatically
    if (product.variants.length > 0 && !productVariantId) {
      finalVariantId = product.variants[0].id;
      this.logger.log(`Auto-selecting first variant ${finalVariantId} for product ${productId}`);
    }
    
    if (finalVariantId) {
      selectedVariant = product.variants.find((v: any) => v.id === finalVariantId) as { id: string; inventoryQuantity: number; trackInventory: boolean } | undefined || null;
      if (!selectedVariant) {
        throw new NotFoundException('Product variant not found');
      }
      
      // Log variant details for debugging
      this.logger.log(`Variant ${finalVariantId}: trackInventory=${selectedVariant.trackInventory}, inventoryQuantity=${selectedVariant.inventoryQuantity}, requestedQuantity=${quantity}`);
      
      // Check inventory only if tracking is enabled (default is true, so we check if it's explicitly false)
      // If trackInventory is undefined/null, default to true (track inventory)
      const shouldTrackInventory = selectedVariant.trackInventory !== false;
      
      // Allow adding to cart even with 0 inventory - we'll check inventory at checkout
      // Only warn if inventory is low but don't block adding to cart
      if (shouldTrackInventory && selectedVariant.inventoryQuantity < quantity) {
        // If product is available, allow adding to cart (might be backorder or restocking)
        // We'll enforce inventory limits at checkout
        if (product.isAvailable) {
          this.logger.warn(`Low inventory for variant ${finalVariantId}: ${selectedVariant.inventoryQuantity} available, requested ${quantity}. Allowing add to cart (will check at checkout).`);
        } else {
          throw new BadRequestException(`Product is not available. Only ${selectedVariant.inventoryQuantity} in stock.`);
        }
      }
      
      // If inventory tracking is disabled, allow adding to cart regardless of inventory
      if (!shouldTrackInventory) {
        this.logger.log(`Inventory tracking disabled for variant ${finalVariantId}, allowing add to cart`);
      }
    }

    // Check if item already in cart (use finalVariantId which may have been auto-selected)
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
        productVariantId: finalVariantId || null,
      },
    });

    let cartItem;
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      
      // Check inventory again for updated quantity (only if tracking is enabled)
      // Allow updating quantity even with low inventory - we'll check at checkout
      if (selectedVariant && selectedVariant.trackInventory !== false && selectedVariant.inventoryQuantity < newQuantity) {
        if (product.isAvailable) {
          this.logger.warn(`Low inventory for variant ${selectedVariant.id}: ${selectedVariant.inventoryQuantity} available, requested ${newQuantity}. Allowing update (will check at checkout).`);
        } else {
          throw new BadRequestException(`Product is not available. Cannot add ${quantity} more. Only ${selectedVariant.inventoryQuantity - existingItem.quantity} available`);
        }
      }

      // Update quantity
      cartItem = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: { 
          product: {
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 10 }
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
          productVariantId: finalVariantId,
          quantity,
        },
        include: { 
          product: {
            include: {
              images: { orderBy: { sortOrder: 'asc' }, take: 10 }
            }
          }, 
          productVariant: true 
        },
      });
    }

    // CRITICAL: Verify the cart item has the correct product
    if (!cartItem.product) {
      this.logger.error(`❌ CRITICAL: Cart item ${cartItem.id} created but product is null! productId: ${productId}`);
      throw new BadRequestException('Failed to link product to cart item. Product data is missing.');
    }
    
    if (cartItem.product.id !== productId) {
      this.logger.error(`❌ CRITICAL: Product ID mismatch! Expected ${productId}, got ${cartItem.product.id}`);
      throw new BadRequestException('Product ID mismatch. Please try again.');
    }
    
    this.logger.log(`✅ Added product ${productId} (${cartItem.product.name || cartItem.product.nameAr || 'Unknown'}) to cart ${cartId}, cartItem: ${cartItem.id}, quantity: ${quantity}`);

    // Get the updated cart with all items - ensure fresh data
    const cart = await this.getCartById(tenantId, cartId);
    this.logger.log(`📦 Cart retrieved after add - cartId: ${cart.id}, total items: ${cart.cartItems?.length || 0}, sessionId: ${cart.sessionId}`);
    
    // Verify the item we just added is in the cart with correct product
    if (cart.cartItems && cart.cartItems.length > 0) {
      const addedItemInCart = cart.cartItems.find((item: any) => item.id === cartItem.id);
      if (addedItemInCart) {
        if (addedItemInCart.product && addedItemInCart.product.id === productId) {
          this.logger.log(`✅ Verified: Cart item ${cartItem.id} has correct product ${productId} (${addedItemInCart.product.name || addedItemInCart.product.nameAr}), quantity: ${addedItemInCart.quantity}`);
        } else {
          this.logger.error(`❌ CRITICAL: Cart item ${cartItem.id} has wrong product! Expected ${productId}, got ${addedItemInCart.product?.id || 'null'}`);
          // Try to reload the cart item with product
          const reloadedItem = await this.prisma.cartItem.findFirst({
            where: { id: cartItem.id },
            include: {
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 10 }
                }
              },
              productVariant: true
            }
          });
          if (reloadedItem && reloadedItem.product) {
            const itemIndex = cart.cartItems.findIndex((item: any) => item.id === cartItem.id);
            if (itemIndex >= 0) {
              cart.cartItems[itemIndex] = reloadedItem;
              this.logger.log(`✅ Reloaded cart item ${cartItem.id} with product data`);
            }
          }
        }
      } else {
        this.logger.warn(`⚠️ Added cartItem ${cartItem.id} not found in cart! Cart has ${cart.cartItems.length} items. Re-fetching cart...`);
        // Re-fetch cart to ensure we have the latest data
        const refreshedCart = await this.getCartById(tenantId, cartId);
        return refreshedCart;
      }
    } else {
      this.logger.warn(`⚠️ Cart has 0 items after adding product ${productId}! Re-fetching cart...`);
      // Re-fetch cart to ensure we have the latest data
      const refreshedCart = await this.getCartById(tenantId, cartId);
      return refreshedCart;
    }

    // Clear Redis cache to force fresh fetch
    if (this.redisService && cart.sessionId) {
      await this.redisService.deleteCartSession(cart.sessionId);
      this.logger.log(`Cleared Redis cache for sessionId: ${cart.sessionId}`);
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

    // Clear Redis cache and return updated cart
    const updatedCart = await this.getCartById(tenantId, cartId);
    if (this.redisService && updatedCart.sessionId) {
      await this.redisService.deleteCartSession(updatedCart.sessionId);
    }

    return updatedCart;
  }

  async removeFromCart(tenantId: string, cartId: string, itemId: string) {
    this.logger.log(`removeFromCart called - tenantId: ${tenantId}, cartId: ${cartId}, itemId: ${itemId}`);
    
    // Clean the itemId - remove any URL encoding artifacts or extra characters
    let cleanItemId = itemId.trim();
    
    // If itemId contains slashes or plus signs, it might be incorrectly formatted
    // Try to extract the actual ID (CUIDs are typically 25 characters, no slashes)
    if (cleanItemId.includes('/') || cleanItemId.includes('+')) {
      // Split by common delimiters and find the longest valid-looking ID
      const parts = cleanItemId.split(/[/+]/);
      const validParts = parts.filter(part => {
        const trimmed = part.trim();
        return trimmed.length >= 20 && !trimmed.includes('/') && !trimmed.includes('+');
      });
      if (validParts.length > 0) {
        // Use the longest valid part
        cleanItemId = validParts.reduce((a, b) => a.length > b.length ? a : b).trim();
        this.logger.log(`Cleaned itemId from "${itemId}" to "${cleanItemId}"`);
      }
    }
    
    // First, get the cart to see what items it has
    const cart = await this.getCartById(tenantId, cartId);
    this.logger.log(`Cart has ${cart.cartItems.length} items`);
    
    if (cart.cartItems.length > 0) {
      this.logger.log(`Cart item IDs: ${cart.cartItems.map((item: any) => item.id).join(', ')}`);
    }
    
    // Try to find by exact ID first (using cleaned ID)
    let cartItem = await this.prisma.cartItem.findFirst({
      where: {
        id: cleanItemId,
        cart: { id: cartId, tenantId },
      },
    });

    // If not found by exact ID, try to find by matching the beginning of the ID
    // (in case the itemId got corrupted with extra characters)
    if (!cartItem && cleanItemId.length > 20) {
      const shortId = cleanItemId.substring(0, 25); // CUIDs are typically 25 chars
      this.logger.log(`Trying to find cart item with ID starting with: ${shortId}`);
      cartItem = await this.prisma.cartItem.findFirst({
        where: {
          id: { startsWith: shortId },
          cart: { id: cartId, tenantId },
        },
      });
    }

    // If still not found, check if itemId might be in the cart items list
    if (!cartItem) {
      const foundInCart = cart.cartItems.find((item: any) => {
        // Try exact match
        if (item.id === cleanItemId) return true;
        // Try if cleaned ID is contained in item ID
        if (item.id.includes(cleanItemId.substring(0, 20))) return true;
        // Try if item ID is contained in cleaned ID
        if (cleanItemId.includes(item.id.substring(0, 20))) return true;
        return false;
      });
      if (foundInCart) {
        this.logger.log(`Found item in cart list, using ID: ${foundInCart.id}`);
        cleanItemId = foundInCart.id;
        cartItem = await this.prisma.cartItem.findFirst({
          where: {
            id: foundInCart.id,
            cart: { id: cartId, tenantId },
          },
        });
      }
    }

    if (!cartItem) {
      // Log more details for debugging
      this.logger.warn(`Cart item not found - itemId: ${itemId}, cleaned: ${cleanItemId}, cartId: ${cartId}, tenantId: ${tenantId}`);
      this.logger.warn(`ItemId length: ${cleanItemId.length}, ItemId contains slashes: ${cleanItemId.includes('/')}, contains plus: ${cleanItemId.includes('+')}`);
      this.logger.warn(`Available cart item IDs in cart: ${cart.cartItems.map((item: any) => item.id).join(', ')}`);
      
      // If cart is empty or item doesn't exist, return the cart as-is (idempotent operation)
      // This handles the case where the item was already removed
      this.logger.log(`Item not found, but returning cart as-is (item may have been already removed)`);
      return cart;
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItem.id },
    });

    this.logger.log(`Removed cart item ${itemId} from cart ${cartId}`);

    // Clear Redis cache (reuse cart from earlier in function)
    if (this.redisService && cart.sessionId) {
      await this.redisService.deleteCartSession(cart.sessionId);
    }

    // Return updated cart
    const updatedCart = await this.getCartById(tenantId, cartId);
    return updatedCart;
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
    this.logger.log(`getCartById called - tenantId: ${tenantId}, cartId: ${cartId}`);
    
    const cart = await this.prisma.cart.findFirst({
      where: { id: cartId, tenantId },
      include: {
        cartItems: {
          include: {
            product: {
              include: {
                images: { 
                  orderBy: { sortOrder: 'asc' },
                  take: 10 // Get more images for better product display
                }
              }
            },
            productVariant: {
              include: {
                product: {
                  include: {
                    images: { 
                      orderBy: { sortOrder: 'asc' },
                      take: 10
                    }
                  }
                }
              }
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart) {
      this.logger.error(`Cart not found - tenantId: ${tenantId}, cartId: ${cartId}`);
      throw new NotFoundException('Cart not found');
    }

    // Ensure cartItems is always an array
    if (!Array.isArray(cart.cartItems)) {
      this.logger.warn(`Cart ${cartId} has non-array cartItems:`, typeof cart.cartItems);
      cart.cartItems = [];
    }

    // Validate that all cart items have valid product data
    // Instead of removing items, try to reload missing products
    const validItems = [];
    for (const item of cart.cartItems) {
      if (!item.product) {
        this.logger.warn(`Cart item ${item.id} has no product data! productId: ${item.productId}, attempting to reload...`);
        // Try to reload the product
        try {
          const product = await this.prisma.product.findFirst({
            where: { id: item.productId, tenantId },
            include: {
              images: { 
                orderBy: { sortOrder: 'asc' },
                take: 10
              }
            }
          });
          if (product) {
            item.product = product;
            this.logger.log(`✅ Reloaded product ${product.id} for cart item ${item.id}`);
            validItems.push(item);
          } else {
            this.logger.error(`❌ Product ${item.productId} not found! Removing cart item ${item.id}`);
            // Only remove if product truly doesn't exist
            try {
              await this.prisma.cartItem.delete({ where: { id: item.id } });
            } catch (deleteError) {
              this.logger.error(`Failed to delete invalid cart item ${item.id}:`, deleteError);
            }
          }
        } catch (reloadError) {
          this.logger.error(`Error reloading product ${item.productId}:`, reloadError);
          // Keep the item but log the error - don't remove it
          validItems.push(item);
        }
      } else {
        // Ensure product has images array
        if (!item.product.images || !Array.isArray(item.product.images)) {
          item.product.images = [];
        }
        validItems.push(item);
      }
    }
    
    // Replace cartItems with validated items
    cart.cartItems = validItems;

    this.logger.log(`getCartById returning - cartId: ${cart.id}, items: ${cart.cartItems.length}, sessionId: ${cart.sessionId}`);
    if (cart.cartItems.length > 0) {
      this.logger.log(`Cart items details:`, cart.cartItems.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        productName: item.product?.name || item.product?.nameAr || 'Unknown',
        productNameAr: item.product?.nameAr,
        hasProduct: !!item.product,
        hasVariant: !!item.productVariant,
        imageCount: item.product?.images?.length || 0,
      })));
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