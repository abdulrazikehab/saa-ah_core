/*
  Warnings:

  - A unique constraint covering the columns `[recoveryId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "GiftType" AS ENUM ('PLAN_UPGRADE', 'FEATURE_ACCESS', 'CREDIT', 'EXTENSION', 'TRIAL');

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'USED');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('SUCCESSFUL_LOGIN', 'FAILED_LOGIN_ATTEMPT', 'SUSPICIOUS_LOGIN', 'BRUTE_FORCE_ATTEMPT', 'FRAUD_ATTEMPT', 'RATE_LIMIT_EXCEEDED', 'UNUSUAL_ACTIVITY', 'SECURITY_BREACH', 'ACCOUNT_LOCKED', 'PASSWORD_RESET_ATTEMPT', 'INVALID_RESET_CODE', 'INVALID_REFRESH_TOKEN', 'DEVICE_FINGERPRINT', 'VM_DETECTED', 'HIGH_RISK_DEVICE', 'MULTIPLE_ACCOUNTS_ON_DEVICE');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'EXPIRED', 'INVALID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CardOrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'DELIVERED', 'PARTIALLY_DELIVERED', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'PURCHASE', 'REFUND', 'BONUS', 'ADJUSTMENT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TopUpPaymentMethod" AS ENUM ('BANK_TRANSFER', 'VISA', 'MASTERCARD', 'MADA', 'APPLE_PAY', 'STC_PAY');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('CART', 'QUICK_RECHARGE', 'REORDER', 'MANUAL');

-- CreateEnum
CREATE TYPE "MerchantOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod2" AS ENUM ('WALLET', 'BANK_TRANSFER', 'MIXED', 'EXTERNAL_GATEWAY');

-- CreateEnum
CREATE TYPE "MerchantPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('CREATED', 'SUBMITTED', 'STATUS_CHANGED', 'PAYMENT_CHANGED', 'PROVIDER_UPDATE', 'NOTE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'MERCHANT', 'EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "PaymentIntentMethod" AS ENUM ('BANK_TRANSFER', 'GATEWAY');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('REQUIRES_ACTION', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('CASHBACK', 'DISCOUNT', 'VOLUME_BASED', 'TIERED', 'PRICE_OVERRIDE');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PriceAlertType" AS ENUM ('ANY_CHANGE', 'DROP_ONLY', 'RISE_ONLY');

-- CreateEnum
CREATE TYPE "MerchantNotificationType" AS ENUM ('ORDER_STATUS', 'PRICE_ALERT', 'PROMOTION', 'LOW_WALLET', 'SUPPORT_UPDATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FavoriteType" AS ENUM ('PRODUCT', 'PLAYER');

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'SUPPLIER';

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'NEOLEAP';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "nameAr" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "aiScript" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brandId" TEXT,
ADD COLUMN     "odooProductId" TEXT,
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "recoveryId" TEXT;

-- CreateTable
CREATE TABLE "platform_features" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameAr" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "requiredPlan" "PlanType" NOT NULL DEFAULT 'STARTER',
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_gifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "giftType" "GiftType" NOT NULL,
    "giftValue" TEXT NOT NULL,
    "giftDetails" JSONB,
    "status" "GiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,

    CONSTRAINT "user_gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "features" TEXT[],
    "featuresAr" TEXT[],
    "limits" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactPerson" TEXT,
    "address" TEXT,
    "discountRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "apiEndpoint" TEXT,
    "apiKey" TEXT,
    "apiConfig" JSONB,
    "autoPurchaseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "priceCheckInterval" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT,
    "shortName" TEXT,
    "brandType" TEXT,
    "logo" TEXT,
    "image" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "rechargeUsdValue" DECIMAL(65,30) DEFAULT 0,
    "usdValueForCoins" DECIMAL(65,30) DEFAULT 0,
    "safetyStock" DECIMAL(65,30) DEFAULT 0,
    "leadTime" INTEGER DEFAULT 0,
    "reorderPoint" DECIMAL(65,30) DEFAULT 0,
    "averageConsumptionPerMonth" DECIMAL(65,30) DEFAULT 0,
    "averageConsumptionPerDay" DECIMAL(65,30) DEFAULT 0,
    "abcAnalysis" TEXT,
    "odooCategoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_suppliers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "discountRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "supplierProductCode" TEXT,
    "lastPrice" DECIMAL(65,30),
    "lastPriceCheck" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(65,30),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "symbol" TEXT NOT NULL,
    "symbolAr" TEXT,
    "exchangeRate" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "precision" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'SAR',
    "autoUpdateRates" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "symbol" TEXT,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "country" TEXT,
    "countryCode" TEXT,
    "city" TEXT,
    "region" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isp" TEXT,
    "isVpn" BOOLEAN NOT NULL DEFAULT false,
    "isProxy" BOOLEAN NOT NULL DEFAULT false,
    "os" TEXT,
    "browser" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "description" TEXT,
    "descriptionAr" TEXT,
    "image" TEXT,
    "productCode" TEXT,
    "denomination" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "wholesalePrice" DECIMAL(65,30) NOT NULL,
    "retailPrice" DECIMAL(65,30) NOT NULL,
    "profitMargin" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0.15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "stockCount" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_inventory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "cardPin" TEXT,
    "expiryDate" TIMESTAMP(3),
    "batchId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "soldAt" TIMESTAMP(3),
    "soldToUserId" TEXT,
    "orderId" TEXT,

    CONSTRAINT "card_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "CardOrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithTax" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "paymentMethod" TEXT NOT NULL DEFAULT 'WALLET',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithTax" DECIMAL(65,30) NOT NULL,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "card_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_deliveries" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "cardPin" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),

    CONSTRAINT "card_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balanceBefore" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "description" TEXT,
    "descriptionAr" TEXT,
    "reference" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "orderId" TEXT,
    "topUpRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_topup_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "paymentMethod" "TopUpPaymentMethod" NOT NULL,
    "bankId" TEXT,
    "senderAccountId" TEXT,
    "senderName" TEXT,
    "transferReference" TEXT,
    "receiptImage" TEXT,
    "notes" TEXT,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedByUserId" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_topup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "code" TEXT NOT NULL,
    "logo" TEXT,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "swiftCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_replies" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isStaffReply" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalCards" INTEGER NOT NULL,
    "validCards" INTEGER NOT NULL,
    "invalidCards" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "card_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MerchantStatus" NOT NULL DEFAULT 'ACTIVE',
    "businessName" TEXT NOT NULL,
    "businessNameAr" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'SA',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'SAR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "settings" JSONB,
    "lowBalanceThreshold" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_game_accounts" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameKey" TEXT NOT NULL,
    "accountIdentifier" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_game_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_carts" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceSnapshot" DECIMAL(65,30),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_orders" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "playerId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "source" "OrderSource" NOT NULL DEFAULT 'CART',
    "originalOrderId" TEXT,
    "status" "MerchantOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod2" NOT NULL DEFAULT 'WALLET',
    "paymentStatus" "MerchantPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "feesTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "profitTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "clientReference" TEXT,
    "notes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "merchant_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshotEn" TEXT NOT NULL,
    "productNameSnapshotAr" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "lineSubtotal" DECIMAL(65,30) NOT NULL,
    "lineDiscount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "lineProfit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "merchant_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_order_deliveries" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "cardCode" TEXT NOT NULL,
    "cardPin" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),

    CONSTRAINT "merchant_order_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "message" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentIntentMethod" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'REQUIRES_ACTION',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "bankAccountId" TEXT,
    "proofAttachmentUrl" TEXT,
    "reviewedByAdminUserId" TEXT,
    "reviewNote" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merchantSnapshot" JSONB NOT NULL,
    "buyerSnapshot" JSONB,
    "itemsSnapshot" JSONB NOT NULL,
    "totalsSnapshot" JSONB NOT NULL,
    "paymentSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "type" "PromotionType" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "conditions" JSONB NOT NULL,
    "benefit" JSONB NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_promotion_progress" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "progress" JSONB NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_promotion_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alert_subscriptions" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "alertType" "PriceAlertType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "lastNotifiedPrice" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_alert_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "oldPrice" DECIMAL(65,30) NOT NULL,
    "newPrice" DECIMAL(65,30) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,
    "reason" TEXT,

    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_notifications" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "MerchantNotificationType" NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT,
    "bodyEn" TEXT NOT NULL,
    "bodyAr" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_favorites_v2" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "FavoriteType" NOT NULL,
    "productId" TEXT,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_favorites_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_audit_logs" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmployeeId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_sessions" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" VARCHAR(512),
    "deviceId" TEXT,
    "deviceName" TEXT,
    "platform" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "merchant_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_product_overrides" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customPrice" DECIMAL(65,30),
    "customCost" DECIMAL(65,30),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_product_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_features_feature_key" ON "platform_features"("feature");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "suppliers_isActive_idx" ON "suppliers"("isActive");

-- CreateIndex
CREATE INDEX "brands_tenantId_idx" ON "brands"("tenantId");

-- CreateIndex
CREATE INDEX "brands_code_idx" ON "brands"("code");

-- CreateIndex
CREATE UNIQUE INDEX "brands_tenantId_code_key" ON "brands"("tenantId", "code");

-- CreateIndex
CREATE INDEX "product_suppliers_productId_idx" ON "product_suppliers"("productId");

-- CreateIndex
CREATE INDEX "product_suppliers_supplierId_idx" ON "product_suppliers"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "product_suppliers_productId_supplierId_key" ON "product_suppliers"("productId", "supplierId");

-- CreateIndex
CREATE INDEX "supplier_purchases_tenantId_idx" ON "supplier_purchases"("tenantId");

-- CreateIndex
CREATE INDEX "supplier_purchases_productId_idx" ON "supplier_purchases"("productId");

-- CreateIndex
CREATE INDEX "supplier_purchases_supplierId_idx" ON "supplier_purchases"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_purchases_status_idx" ON "supplier_purchases"("status");

-- CreateIndex
CREATE INDEX "currencies_tenantId_idx" ON "currencies"("tenantId");

-- CreateIndex
CREATE INDEX "currencies_isActive_idx" ON "currencies"("isActive");

-- CreateIndex
CREATE INDEX "currencies_isDefault_idx" ON "currencies"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_tenantId_code_key" ON "currencies"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "currency_settings_tenantId_key" ON "currency_settings"("tenantId");

-- CreateIndex
CREATE INDEX "units_tenantId_idx" ON "units"("tenantId");

-- CreateIndex
CREATE INDEX "units_isActive_idx" ON "units"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "units_tenantId_code_key" ON "units"("tenantId", "code");

-- CreateIndex
CREATE INDEX "security_events_type_severity_idx" ON "security_events"("type", "severity");

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");

-- CreateIndex
CREATE INDEX "security_events_tenantId_idx" ON "security_events"("tenantId");

-- CreateIndex
CREATE INDEX "security_events_userId_idx" ON "security_events"("userId");

-- CreateIndex
CREATE INDEX "card_products_tenantId_idx" ON "card_products"("tenantId");

-- CreateIndex
CREATE INDEX "card_products_brandId_idx" ON "card_products"("brandId");

-- CreateIndex
CREATE INDEX "card_products_categoryId_idx" ON "card_products"("categoryId");

-- CreateIndex
CREATE INDEX "card_products_isActive_isAvailable_idx" ON "card_products"("isActive", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "card_products_tenantId_productCode_key" ON "card_products"("tenantId", "productCode");

-- CreateIndex
CREATE INDEX "card_inventory_tenantId_idx" ON "card_inventory"("tenantId");

-- CreateIndex
CREATE INDEX "card_inventory_productId_idx" ON "card_inventory"("productId");

-- CreateIndex
CREATE INDEX "card_inventory_status_idx" ON "card_inventory"("status");

-- CreateIndex
CREATE INDEX "card_inventory_batchId_idx" ON "card_inventory"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "card_inventory_tenantId_cardCode_key" ON "card_inventory"("tenantId", "cardCode");

-- CreateIndex
CREATE INDEX "card_orders_tenantId_idx" ON "card_orders"("tenantId");

-- CreateIndex
CREATE INDEX "card_orders_userId_idx" ON "card_orders"("userId");

-- CreateIndex
CREATE INDEX "card_orders_status_idx" ON "card_orders"("status");

-- CreateIndex
CREATE INDEX "card_orders_createdAt_idx" ON "card_orders"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "card_orders_tenantId_orderNumber_key" ON "card_orders"("tenantId", "orderNumber");

-- CreateIndex
CREATE INDEX "card_order_items_orderId_idx" ON "card_order_items"("orderId");

-- CreateIndex
CREATE INDEX "card_order_items_productId_idx" ON "card_order_items"("productId");

-- CreateIndex
CREATE INDEX "card_deliveries_orderItemId_idx" ON "card_deliveries"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallets_tenantId_idx" ON "wallets"("tenantId");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_orderId_key" ON "wallet_transactions"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_topUpRequestId_key" ON "wallet_transactions"("topUpRequestId");

-- CreateIndex
CREATE INDEX "wallet_transactions_walletId_idx" ON "wallet_transactions"("walletId");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE INDEX "wallet_transactions_createdAt_idx" ON "wallet_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "wallet_topup_requests_tenantId_idx" ON "wallet_topup_requests"("tenantId");

-- CreateIndex
CREATE INDEX "wallet_topup_requests_userId_idx" ON "wallet_topup_requests"("userId");

-- CreateIndex
CREATE INDEX "wallet_topup_requests_status_idx" ON "wallet_topup_requests"("status");

-- CreateIndex
CREATE INDEX "wallet_topup_requests_createdAt_idx" ON "wallet_topup_requests"("createdAt");

-- CreateIndex
CREATE INDEX "banks_tenantId_idx" ON "banks"("tenantId");

-- CreateIndex
CREATE INDEX "banks_isActive_idx" ON "banks"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "banks_tenantId_code_key" ON "banks"("tenantId", "code");

-- CreateIndex
CREATE INDEX "bank_accounts_userId_idx" ON "bank_accounts"("userId");

-- CreateIndex
CREATE INDEX "merchant_favorites_userId_idx" ON "merchant_favorites"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_favorites_userId_productId_key" ON "merchant_favorites"("userId", "productId");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_idx" ON "support_tickets"("tenantId");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_tenantId_ticketNumber_key" ON "support_tickets"("tenantId", "ticketNumber");

-- CreateIndex
CREATE INDEX "ticket_replies_ticketId_idx" ON "ticket_replies"("ticketId");

-- CreateIndex
CREATE INDEX "card_batches_tenantId_idx" ON "card_batches"("tenantId");

-- CreateIndex
CREATE INDEX "card_batches_productId_idx" ON "card_batches"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_userId_key" ON "merchants"("userId");

-- CreateIndex
CREATE INDEX "merchants_tenantId_idx" ON "merchants"("tenantId");

-- CreateIndex
CREATE INDEX "merchants_status_idx" ON "merchants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_tenantId_userId_key" ON "merchants"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_merchantId_idx" ON "employees"("merchantId");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_merchantId_username_key" ON "employees"("merchantId", "username");

-- CreateIndex
CREATE INDEX "players_merchantId_idx" ON "players"("merchantId");

-- CreateIndex
CREATE INDEX "players_merchantId_name_idx" ON "players"("merchantId", "name");

-- CreateIndex
CREATE INDEX "players_merchantId_phone_idx" ON "players"("merchantId", "phone");

-- CreateIndex
CREATE INDEX "player_game_accounts_playerId_idx" ON "player_game_accounts"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_game_accounts_playerId_gameKey_accountIdentifier_key" ON "player_game_accounts"("playerId", "gameKey", "accountIdentifier");

-- CreateIndex
CREATE INDEX "merchant_carts_merchantId_idx" ON "merchant_carts"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_carts_merchantId_employeeId_key" ON "merchant_carts"("merchantId", "employeeId");

-- CreateIndex
CREATE INDEX "merchant_cart_items_cartId_idx" ON "merchant_cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_cart_items_cartId_productId_key" ON "merchant_cart_items"("cartId", "productId");

-- CreateIndex
CREATE INDEX "merchant_orders_merchantId_createdAt_idx" ON "merchant_orders"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "merchant_orders_merchantId_status_idx" ON "merchant_orders"("merchantId", "status");

-- CreateIndex
CREATE INDEX "merchant_orders_merchantId_playerId_idx" ON "merchant_orders"("merchantId", "playerId");

-- CreateIndex
CREATE INDEX "merchant_orders_originalOrderId_idx" ON "merchant_orders"("originalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_orders_merchantId_orderNumber_key" ON "merchant_orders"("merchantId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_orders_merchantId_idempotencyKey_key" ON "merchant_orders"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "merchant_order_items_orderId_idx" ON "merchant_order_items"("orderId");

-- CreateIndex
CREATE INDEX "merchant_order_items_productId_idx" ON "merchant_order_items"("productId");

-- CreateIndex
CREATE INDEX "merchant_order_deliveries_orderItemId_idx" ON "merchant_order_deliveries"("orderItemId");

-- CreateIndex
CREATE INDEX "merchant_order_events_orderId_createdAt_idx" ON "merchant_order_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_intents_orderId_idx" ON "payment_intents"("orderId");

-- CreateIndex
CREATE INDEX "payment_intents_status_createdAt_idx" ON "payment_intents"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orderId_key" ON "invoices"("orderId");

-- CreateIndex
CREATE INDEX "invoices_merchantId_issuedAt_idx" ON "invoices"("merchantId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_merchantId_invoiceNumber_key" ON "invoices"("merchantId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "promotions_tenantId_idx" ON "promotions"("tenantId");

-- CreateIndex
CREATE INDEX "promotions_status_startAt_endAt_idx" ON "promotions"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "merchant_promotion_progress_promotionId_idx" ON "merchant_promotion_progress"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_promotion_progress_merchantId_promotionId_key" ON "merchant_promotion_progress"("merchantId", "promotionId");

-- CreateIndex
CREATE INDEX "price_alert_subscriptions_productId_isActive_idx" ON "price_alert_subscriptions"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "price_alert_subscriptions_merchantId_productId_alertType_key" ON "price_alert_subscriptions"("merchantId", "productId", "alertType");

-- CreateIndex
CREATE INDEX "product_price_history_productId_changedAt_idx" ON "product_price_history"("productId", "changedAt");

-- CreateIndex
CREATE INDEX "merchant_notifications_merchantId_createdAt_idx" ON "merchant_notifications"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "merchant_notifications_merchantId_readAt_idx" ON "merchant_notifications"("merchantId", "readAt");

-- CreateIndex
CREATE INDEX "merchant_favorites_v2_merchantId_type_idx" ON "merchant_favorites_v2"("merchantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_favorites_v2_merchantId_type_productId_key" ON "merchant_favorites_v2"("merchantId", "type", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_favorites_v2_merchantId_type_playerId_key" ON "merchant_favorites_v2"("merchantId", "type", "playerId");

-- CreateIndex
CREATE INDEX "merchant_audit_logs_merchantId_createdAt_idx" ON "merchant_audit_logs"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "merchant_audit_logs_actorUserId_createdAt_idx" ON "merchant_audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "merchant_audit_logs_action_createdAt_idx" ON "merchant_audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "merchant_sessions_merchantId_revokedAt_idx" ON "merchant_sessions"("merchantId", "revokedAt");

-- CreateIndex
CREATE INDEX "merchant_sessions_userId_createdAt_idx" ON "merchant_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "merchant_product_overrides_merchantId_idx" ON "merchant_product_overrides"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_product_overrides_merchantId_productId_key" ON "merchant_product_overrides"("merchantId", "productId");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_idx" ON "api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "api_keys_apiKey_idx" ON "api_keys"("apiKey");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "products_tenantId_productCode_idx" ON "products"("tenantId", "productCode");

-- CreateIndex
CREATE INDEX "products_unitId_idx" ON "products"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "users_recoveryId_key" ON "users"("recoveryId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gifts" ADD CONSTRAINT "user_gifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gifts" ADD CONSTRAINT "user_gifts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchases" ADD CONSTRAINT "supplier_purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_purchases" ADD CONSTRAINT "supplier_purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_settings" ADD CONSTRAINT "currency_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_products" ADD CONSTRAINT "card_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_products" ADD CONSTRAINT "card_products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_products" ADD CONSTRAINT "card_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_inventory" ADD CONSTRAINT "card_inventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_inventory" ADD CONSTRAINT "card_inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_inventory" ADD CONSTRAINT "card_inventory_soldToUserId_fkey" FOREIGN KEY ("soldToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_inventory" ADD CONSTRAINT "card_inventory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "card_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_order_items" ADD CONSTRAINT "card_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_order_items" ADD CONSTRAINT "card_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_deliveries" ADD CONSTRAINT "card_deliveries_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "card_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "card_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_topUpRequestId_fkey" FOREIGN KEY ("topUpRequestId") REFERENCES "wallet_topup_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topup_requests" ADD CONSTRAINT "wallet_topup_requests_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_favorites" ADD CONSTRAINT "merchant_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_favorites" ADD CONSTRAINT "merchant_favorites_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_batches" ADD CONSTRAINT "card_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_batches" ADD CONSTRAINT "card_batches_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_accounts" ADD CONSTRAINT "player_game_accounts_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_carts" ADD CONSTRAINT "merchant_carts_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_carts" ADD CONSTRAINT "merchant_carts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_cart_items" ADD CONSTRAINT "merchant_cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "merchant_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_cart_items" ADD CONSTRAINT "merchant_cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_orders" ADD CONSTRAINT "merchant_orders_originalOrderId_fkey" FOREIGN KEY ("originalOrderId") REFERENCES "merchant_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_order_items" ADD CONSTRAINT "merchant_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "merchant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_order_items" ADD CONSTRAINT "merchant_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_order_deliveries" ADD CONSTRAINT "merchant_order_deliveries_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "merchant_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_order_events" ADD CONSTRAINT "merchant_order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "merchant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "merchant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "merchant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_promotion_progress" ADD CONSTRAINT "merchant_promotion_progress_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_promotion_progress" ADD CONSTRAINT "merchant_promotion_progress_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alert_subscriptions" ADD CONSTRAINT "price_alert_subscriptions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alert_subscriptions" ADD CONSTRAINT "price_alert_subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_notifications" ADD CONSTRAINT "merchant_notifications_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_favorites_v2" ADD CONSTRAINT "merchant_favorites_v2_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_favorites_v2" ADD CONSTRAINT "merchant_favorites_v2_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_favorites_v2" ADD CONSTRAINT "merchant_favorites_v2_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_audit_logs" ADD CONSTRAINT "merchant_audit_logs_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_audit_logs" ADD CONSTRAINT "merchant_audit_logs_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sessions" ADD CONSTRAINT "merchant_sessions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_sessions" ADD CONSTRAINT "merchant_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_product_overrides" ADD CONSTRAINT "merchant_product_overrides_productId_fkey" FOREIGN KEY ("productId") REFERENCES "card_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
