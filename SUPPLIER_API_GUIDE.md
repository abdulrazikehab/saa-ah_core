# Supplier API System - How It Works

## Overview

The Supplier API system allows you to automatically purchase products from multiple suppliers based on price comparison. The system:
- Fetches prices from up to 3 suppliers per product
- Automatically selects the supplier with the best price
- Monitors price changes and stops purchases if prices become unfavorable
- Handles refunds when purchases are cancelled

## Database Schema Changes

### Supplier Model (Extended)
```prisma
model Supplier {
  // ... existing fields ...
  apiEndpoint        String?    // Supplier API base URL
  apiKey            String?    // API authentication key
  apiConfig         Json?      // Additional API configuration
  autoPurchaseEnabled Boolean   // Enable auto-purchase
  priceCheckInterval Int?       // Price check frequency (minutes)
}
```

### ProductSupplier Model (Extended)
```prisma
model ProductSupplier {
  // ... existing fields ...
  supplierProductCode String?   // Product code in supplier's system
  lastPrice          Decimal?    // Last fetched price
  lastPriceCheck     DateTime?   // Last price check timestamp
}
```

### SupplierPurchase Model (New)
```prisma
model SupplierPurchase {
  id          String   @id
  tenantId    String
  productId   String
  supplierId  String
  quantity    Int
  unitPrice   Decimal
  totalAmount Decimal
  status      String   // PENDING, COMPLETED, CANCELLED, REFUNDED
  // ... timestamps and relations ...
}
```

## How It Works

### 1. Setting Up Supplier APIs

When creating or updating a supplier, you can now add API configuration:

```typescript
POST /api/suppliers
{
  "name": "Supplier ABC",
  "apiEndpoint": "https://api.supplier-abc.com/v1",
  "apiKey": "your-api-key-here",
  "apiConfig": {
    "authType": "bearer",  // or "header"
    "authHeader": "X-API-Key"  // if authType is "header"
  },
  "autoPurchaseEnabled": true,
  "priceCheckInterval": 60  // Check prices every 60 minutes
}
```

### 2. Linking Products to Suppliers

Link products to suppliers (up to 3 per product):

```typescript
POST /api/product-suppliers
{
  "productId": "product-123",
  "supplierId": "supplier-456",
  "supplierProductCode": "SUP-789",  // Product code in supplier's system
  "isPrimary": false
}
```

### 3. Auto-Purchase Flow

#### Step 1: Get Best Supplier
```typescript
GET /api/supplier-api/best/:productId
```

This endpoint:
1. Fetches prices from all linked suppliers
2. Filters suppliers where:
   - `supplierPrice > productCost` (we make profit)
   - `supplierPrice < productSellingPrice` (we can sell it)
3. Returns the supplier with the lowest price

**Response:**
```json
{
  "supplierId": "supplier-456",
  "supplierName": "Supplier ABC",
  "price": 50.00,
  "shouldPurchase": true,
  "reason": "Best price: 50.00 (cost: 30.00, selling: 80.00)"
}
```

#### Step 2: Auto-Purchase
```typescript
POST /api/supplier-api/auto-purchase/:productId
{
  "quantity": 10
}
```

This endpoint:
1. Calls `selectBestSupplier()` to find the best supplier
2. Verifies the price is still favorable
3. Calls the supplier's purchase API
4. Creates a `SupplierPurchase` record
5. Returns purchase confirmation

**Supplier API Expected Format:**
- **Price Endpoint:** `POST {apiEndpoint}/price`
  ```json
  Request: { "productCode": "SUP-789", "productId": "product-123" }
  Response: { "price": 50.00, "available": true, "productCode": "SUP-789" }
  ```

- **Purchase Endpoint:** `POST {apiEndpoint}/purchase`
  ```json
  Request: { "productCode": "SUP-789", "quantity": 10 }
  Response: { "orderId": "order-123", "status": "confirmed" }
  ```

### 4. Price Monitoring

Monitor active purchases to detect price changes:

```typescript
POST /api/supplier-api/monitor
```

This endpoint:
1. Finds all active purchases (`status = 'COMPLETED'`)
2. For each purchase, checks current supplier price
3. If price becomes unfavorable:
   - Calls supplier refund API
   - Updates purchase status to `REFUNDED` or `CANCELLED`
   - Records refund amount

**When to Stop Purchasing:**
- Supplier price ≤ product cost (no profit)
- Supplier price ≥ product selling price (can't sell)

**Supplier Refund API Expected Format:**
- **Refund Endpoint:** `POST {apiEndpoint}/refund`
  ```json
  Request: { "purchaseId": "purchase-123", "reason": "Price increased" }
  Response: { "refundAmount": 500.00, "status": "refunded" }
  ```

### 5. Manual Operations

#### Get Price from Specific Supplier
```typescript
GET /api/supplier-api/price/:productId/:supplierId
```

#### Get Prices from All Suppliers
```typescript
GET /api/supplier-api/prices/:productId
```

#### Purchase from Specific Supplier
```typescript
POST /api/supplier-api/purchase/:productId/:supplierId
{
  "quantity": 5
}
```

#### Cancel Purchase and Request Refund
```typescript
POST /api/supplier-api/cancel/:purchaseId
{
  "reason": "Price increased beyond threshold"
}
```

#### Check if Should Stop Purchasing
```typescript
GET /api/supplier-api/should-stop/:productId/:supplierId
```

## Business Logic

### Price Selection Criteria

A supplier is considered "best" if:
1. ✅ Product is available from supplier
2. ✅ `supplierPrice > productCost` (ensures profit margin)
3. ✅ `supplierPrice < productSellingPrice` (ensures we can sell)
4. ✅ Has the lowest price among all valid suppliers

### Example Scenario

**Product:**
- Cost: $30
- Selling Price: $80

**Suppliers:**
- Supplier A: $25 (❌ Too low - less than cost)
- Supplier B: $50 (✅ Valid - between cost and selling price)
- Supplier C: $55 (✅ Valid - between cost and selling price)
- Supplier D: $85 (❌ Too high - more than selling price)

**Result:** Supplier B is selected ($50 is the lowest valid price)

### Price Change Monitoring

If you purchased from Supplier B at $50, and later:
- Price increases to $60: Still valid (between $30 and $80)
- Price increases to $90: ❌ Stop purchasing (above selling price)
- Price decreases to $25: ❌ Stop purchasing (below cost)

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/supplier-api/price/:productId/:supplierId` | Get price from specific supplier |
| GET | `/api/supplier-api/prices/:productId` | Get prices from all suppliers |
| GET | `/api/supplier-api/best/:productId` | Get best supplier for product |
| POST | `/api/supplier-api/purchase/:productId/:supplierId` | Purchase from specific supplier |
| POST | `/api/supplier-api/auto-purchase/:productId` | Auto-purchase from best supplier |
| POST | `/api/supplier-api/cancel/:purchaseId` | Cancel purchase and refund |
| POST | `/api/supplier-api/monitor` | Monitor active purchases |
| GET | `/api/supplier-api/should-stop/:productId/:supplierId` | Check if should stop purchasing |

## Integration Steps

1. **Add Supplier with API:**
   ```typescript
   POST /api/suppliers
   {
     "name": "My Supplier",
     "apiEndpoint": "https://api.example.com",
     "apiKey": "secret-key",
     "autoPurchaseEnabled": true
   }
   ```

2. **Link Product to Supplier:**
   ```typescript
   POST /api/product-suppliers
   {
     "productId": "prod-123",
     "supplierId": "supp-456",
     "supplierProductCode": "SUP-789"
   }
   ```

3. **Auto-Purchase:**
   ```typescript
   POST /api/supplier-api/auto-purchase/prod-123
   {
     "quantity": 10
   }
   ```

4. **Monitor Prices (run periodically, e.g., via cron):**
   ```typescript
   POST /api/supplier-api/monitor
   ```

## Error Handling

- If supplier API is unavailable, the system logs the error and continues with other suppliers
- If price check fails, the purchase is not made
- If refund API fails, the purchase is marked as `CANCELLED` (not `REFUNDED`)
- All operations are logged for audit purposes

## Security

- All endpoints require JWT authentication
- Tenant isolation is enforced (users can only access their tenant's data)
- API keys are stored in the database (consider encryption for production)
- All API calls to suppliers use HTTPS (recommended)

## Next Steps

1. Set up a cron job or scheduled task to run `/api/supplier-api/monitor` periodically
2. Configure supplier APIs according to their documentation
3. Test with one product and supplier first
4. Monitor purchase records in the `supplier_purchases` table

