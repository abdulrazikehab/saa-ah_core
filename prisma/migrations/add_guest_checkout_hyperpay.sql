-- Migration: Add Guest Checkout and HyperPay Support
-- Date: 2024-11-25

-- 1. Add userId field to Order (make it optional for guest checkout)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- 2. Add guest checkout fields (if not exist)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN DEFAULT false;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "guestPhone" TEXT;

-- 3. Create PaymentSettings table for HyperPay configuration
CREATE TABLE IF NOT EXISTS "payment_settings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL UNIQUE,
  
  -- HyperPay Settings
  "hyperPayEnabled" BOOLEAN DEFAULT false,
  "hyperPayEntityId" TEXT,
  "hyperPayAccessToken" TEXT,
  "hyperPayTestMode" BOOLEAN DEFAULT true,
  "hyperPayCurrency" TEXT DEFAULT 'SAR',
  
  -- Stripe Settings (for future)
  "stripeEnabled" BOOLEAN DEFAULT false,
  "stripePublishableKey" TEXT,
  "stripeSecretKey" TEXT,
  
  -- PayPal Settings (for future)
  "payPalEnabled" BOOLEAN DEFAULT false,
  "payPalClientId" TEXT,
  "payPalSecret" TEXT,
  
  -- Cash on Delivery
  "codEnabled" BOOLEAN DEFAULT true,
  
  -- Timestamps
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 4. Create Integration table for API integrations
CREATE TABLE IF NOT EXISTS "integrations" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- 'shipping', 'sms', 'email', 'webhook', 'analytics'
  "provider" TEXT NOT NULL, -- 'aramex', 'twilio', 'sendgrid', etc.
  "name" TEXT NOT NULL,
  "apiKey" TEXT,
  "apiSecret" TEXT,
  "endpoint" TEXT,
  "config" JSONB DEFAULT '{}',
  "enabled" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 5. Create Permission table for RBAC
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL, -- 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'
  "resources" JSONB DEFAULT '{}', -- { "products": ["create", "read", "update", "delete"], ... }
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("tenantId", "userId")
);

-- 6. Create KYC table for verification
CREATE TABLE IF NOT EXISTS "kyc" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,
  "tenantId" TEXT NOT NULL,
  
  -- Verification Status
  "emailVerified" BOOLEAN DEFAULT false,
  "phoneVerified" BOOLEAN DEFAULT false,
  "idVerified" BOOLEAN DEFAULT false,
  
  -- Documents
  "idType" TEXT, -- 'passport', 'national_id', 'drivers_license'
  "idNumber" TEXT,
  "idFrontImage" TEXT,
  "idBackImage" TEXT,
  "selfieImage" TEXT,
  
  -- Status
  "status" TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  "rejectionReason" TEXT,
  "verifiedAt" TIMESTAMP,
  "verifiedBy" TEXT, -- Admin user ID
  
  -- Timestamps
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 7. Create CheckoutSettings table
CREATE TABLE IF NOT EXISTS "checkout_settings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL UNIQUE,
  
  -- Guest Checkout
  "allowGuestCheckout" BOOLEAN DEFAULT true,
  "requireEmailForGuests" BOOLEAN DEFAULT true,
  "requirePhoneForGuests" BOOLEAN DEFAULT true,
  "forceAccountCreation" BOOLEAN DEFAULT false,
  
  -- KYC Requirements
  "requireEmailVerification" BOOLEAN DEFAULT false,
  "requirePhoneVerification" BOOLEAN DEFAULT false,
  "requireIdVerification" BOOLEAN DEFAULT false,
  "idVerificationThreshold" DECIMAL DEFAULT 1000, -- Require ID for orders > this amount
  
  -- Timestamps
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 8. Add indexes
CREATE INDEX IF NOT EXISTS "idx_orders_userId" ON "orders"("userId");
CREATE INDEX IF NOT EXISTS "idx_orders_isGuest" ON "orders"("isGuest");
CREATE INDEX IF NOT EXISTS "idx_integrations_tenant_type" ON "integrations"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "idx_permissions_tenant_user" ON "permissions"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "idx_kyc_userId" ON "kyc"("userId");
CREATE INDEX IF NOT EXISTS "idx_kyc_status" ON "kyc"("status");

-- 9. Insert default settings for existing tenants
INSERT INTO "payment_settings" ("tenantId", "hyperPayEnabled", "codEnabled")
SELECT id, false, true FROM "tenants"
ON CONFLICT ("tenantId") DO NOTHING;

INSERT INTO "checkout_settings" ("tenantId", "allowGuestCheckout")
SELECT id, true FROM "tenants"
ON CONFLICT ("tenantId") DO NOTHING;

COMMENT ON TABLE "payment_settings" IS 'Payment gateway configurations per tenant';
COMMENT ON TABLE "integrations" IS 'Third-party API integrations (shipping, SMS, email, etc.)';
COMMENT ON TABLE "permissions" IS 'Role-based access control for users';
COMMENT ON TABLE "kyc" IS 'Know Your Customer verification data';
COMMENT ON TABLE "checkout_settings" IS 'Checkout and guest settings per tenant';
