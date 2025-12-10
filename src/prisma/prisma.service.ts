import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public prisma: any;
  refreshToken: any;

  constructor() {
    console.log('🔧 Core PrismaService constructor called');
    try {
      const { PrismaClient } = require('.prisma/client');
      this.prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
      });
      
      // Register Encryption Middleware
      try {
        const { EncryptionMiddleware } = require('./prisma-encryption.middleware');
        this.prisma.$use(EncryptionMiddleware);
        console.log('✅ Encryption Middleware registered');
      } catch (e) {
        console.error('⚠️ Failed to register Encryption Middleware:', e);
      }

      console.log('✅ Core PrismaClient created successfully');
    } catch (error) {
      console.error('❌ Failed to create Core PrismaClient:', error);
      throw error;
    }
  }

  async onModuleInit() {
    console.log('🔧 Core PrismaService onModuleInit called');
    try {
      await this.prisma.$connect();
      console.log('✅ Core Prisma connected to database');
    } catch (error) {
      console.error('❌ Failed to connect to Core database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    console.log('❌ Core Prisma disconnected from database');
  }

  // Expose all Prisma models
  get user() { return this.prisma.user; }
  get tenant() { return this.prisma.tenant; }
  get product() { return this.prisma.product; }
  get productVariant() { return this.prisma.productVariant; }
  get productImage() { return this.prisma.productImage; }
  get category() { return this.prisma.category; }
  get productCategory() { return this.prisma.productCategory; }
  get order() { return this.prisma.order; }
  get orderItem() { return this.prisma.orderItem; }
  get customDomain() { return this.prisma.customDomain; }
  get cart() { return this.prisma.cart; }
  get cartItem() { return this.prisma.cartItem; }
  
  // Additional Models
  get productCollection() { return this.prisma.productCollection; }
  get productCollectionItem() { return this.prisma.productCollectionItem; }
  get productTag() { return this.prisma.productTag; }
  get productTagItem() { return this.prisma.productTagItem; }
  get coupon() { return this.prisma.coupon; }
  get couponRedemption() { return this.prisma.couponRedemption; }
  get shippingZone() { return this.prisma.shippingZone; }
  get shippingMethod() { return this.prisma.shippingMethod; }
  get taxRate() { return this.prisma.taxRate; }
  get paymentMethod() { return this.prisma.paymentMethod; }
  get sslCertificate() { return this.prisma.sslCertificate; }
  get webhookEndpoint() { return this.prisma.webhookEndpoint; }
  get webhookDelivery() { return this.prisma.webhookDelivery; }
  get payment() { return this.prisma.payment; }
  get refund() { return this.prisma.refund; }
  get theme() { return this.prisma.theme; }
  get themeVersion() { return this.prisma.themeVersion; }
  get plugin() { return this.prisma.plugin; }
  get page() { return this.prisma.page; }
  get pageHistory() { return this.prisma.pageHistory; }
  get template() { return this.prisma.template; }
  get siteConfig() { return this.prisma.siteConfig; }
  get activityLog() { return this.prisma.activityLog; }
  get chatMessage() { return this.prisma.chatMessage; }
  get transaction() { return this.prisma.transaction; }

  // Master Admin Models
  get partner() { return this.prisma.partner; }
  get auditLog() { return this.prisma.auditLog; }
  get platformFeature() { return this.prisma.platformFeature; }
  get userGift() { return this.prisma.userGift; }
  get subscriptionPlan() { return this.prisma.subscriptionPlan; }
  get featureFlag() { return this.prisma.featureFlag; }
  get platformConfig() { return this.prisma.platformConfig; }
  get paymentPlan() { return this.prisma.paymentPlan; }
  get integration() { return this.prisma.integration; }
  get securityEvent() { return this.prisma.securityEvent; }

  $transaction(p: any) {
    return this.prisma.$transaction(p);
  }
}