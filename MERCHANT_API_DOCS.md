# Merchant Dealer App - API Documentation

**Base URL:** `{{baseUrl}}/api/merchant`

**Authentication:** All endpoints require Bearer token authentication unless marked as Public.

**Headers:**
```
Authorization: Bearer {{accessToken}}
X-Tenant-Id: {{tenantId}}
Content-Type: application/json
```

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Merchant Profile](#2-merchant-profile)
3. [Employees](#3-employees)
4. [Players](#4-players)
5. [Products & Categories](#5-products--categories)
6. [Cart](#6-cart)
7. [Orders](#7-orders)
8. [Favorites](#8-favorites)
9. [Promotions](#9-promotions)
10. [Price Alerts](#10-price-alerts)
11. [Notifications](#11-notifications)
12. [Invoices](#12-invoices)
13. [Dashboard & Reports](#13-dashboard--reports)
14. [Sessions](#14-sessions)

---

## 1. Authentication

### Get Current User (Me)
Get the authenticated user with merchant context.

```
GET /api/merchant/auth/me
```

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "merchant@example.com",
    "role": "SHOP_OWNER"
  },
  "merchant": {
    "id": "merchant_id",
    "businessName": "My Game Shop",
    "businessNameAr": "متجر الألعاب",
    "status": "ACTIVE",
    "defaultCurrency": "SAR",
    "timezone": "Asia/Riyadh"
  },
  "isOwner": true,
  "employeeId": null,
  "permissions": null
}
```

### Change Password
```
POST /api/merchant/auth/change-password
```

**Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Password changed successfully"
}
```

---

## 2. Merchant Profile

### Get Profile
```
GET /api/merchant/profile
```

**Response:**
```json
{
  "id": "merchant_id",
  "businessName": "My Game Shop",
  "businessNameAr": "متجر الألعاب",
  "phone": "+966500000000",
  "email": "merchant@example.com",
  "countryCode": "SA",
  "defaultCurrency": "SAR",
  "timezone": "Asia/Riyadh",
  "status": "ACTIVE",
  "settings": {},
  "lowBalanceThreshold": 100,
  "walletBalance": 5000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Profile
```
PATCH /api/merchant/profile
```

**Body:**
```json
{
  "businessName": "Updated Shop Name",
  "businessNameAr": "اسم المتجر المحدث",
  "phone": "+966500000001",
  "timezone": "Asia/Riyadh",
  "lowBalanceThreshold": 200
}
```

### Get Settings
```
GET /api/merchant/profile/settings
```

**Response:**
```json
{
  "locale": "ar",
  "theme": "system",
  "notificationPreferences": {
    "orderUpdates": true,
    "priceAlerts": true,
    "promotions": true,
    "lowBalance": true
  }
}
```

### Update Settings
```
PATCH /api/merchant/profile/settings
```

**Body:**
```json
{
  "locale": "en",
  "theme": "dark",
  "notificationPreferences": {
    "orderUpdates": true,
    "priceAlerts": false
  }
}
```

---

## 3. Employees

### List Employees
```
GET /api/merchant/employees
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `ACTIVE`, `DISABLED` |
| q | string | Search by name or username |

**Response:**
```json
[
  {
    "id": "employee_id",
    "name": "John Doe",
    "username": "johnd",
    "phone": "+966500000000",
    "status": "ACTIVE",
    "permissions": {
      "ordersCreate": true,
      "ordersRead": true,
      "reportsRead": false,
      "walletRead": false,
      "playersWrite": true,
      "employeesManage": false,
      "settingsWrite": false,
      "invoicesRead": true
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create Employee
```
POST /api/merchant/employees
```

**Body:**
```json
{
  "name": "John Doe",
  "username": "johnd",
  "password": "securePass123",
  "phone": "+966500000000",
  "permissions": {
    "ordersCreate": true,
    "ordersRead": true,
    "reportsRead": false,
    "walletRead": false,
    "playersWrite": true,
    "employeesManage": false,
    "settingsWrite": false,
    "invoicesRead": true
  }
}
```

### Get Employee
```
GET /api/merchant/employees/:id
```

### Update Employee
```
PATCH /api/merchant/employees/:id
```

**Body:**
```json
{
  "name": "John Updated",
  "phone": "+966500000001",
  "status": "ACTIVE",
  "permissions": {
    "ordersCreate": true,
    "ordersRead": true,
    "reportsRead": true
  }
}
```

### Delete Employee (Disable)
```
DELETE /api/merchant/employees/:id
```

**Response:**
```json
{
  "ok": true
}
```

---

## 4. Players

### List Players
```
GET /api/merchant/players
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search by name or phone |
| favorite | boolean | Filter favorites only |
| cursor | string | Pagination cursor |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "items": [
    {
      "id": "player_id",
      "name": "Ahmed Ali",
      "phone": "+966500000000",
      "notes": "Regular customer",
      "isFavorite": true,
      "accountsCount": 3,
      "lastOrderAt": "2024-01-15T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": "next_cursor_id"
}
```

### Create Player
```
POST /api/merchant/players
```

**Body:**
```json
{
  "name": "Ahmed Ali",
  "phone": "+966500000000",
  "notes": "VIP customer",
  "accounts": [
    {
      "gameKey": "pubg",
      "accountIdentifier": "5123456789",
      "label": "Main Account"
    },
    {
      "gameKey": "freefire",
      "accountIdentifier": "FF123456",
      "label": "Secondary"
    }
  ]
}
```

### Get Player
```
GET /api/merchant/players/:id
```

**Response:**
```json
{
  "id": "player_id",
  "name": "Ahmed Ali",
  "phone": "+966500000000",
  "notes": "VIP customer",
  "isFavorite": true,
  "accountsCount": 2,
  "accounts": [
    {
      "id": "account_id",
      "gameKey": "pubg",
      "accountIdentifier": "5123456789",
      "label": "Main Account",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "ordersCount": 15,
  "totalSpent": 2500,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Player
```
PATCH /api/merchant/players/:id
```

**Body:**
```json
{
  "name": "Ahmed Ali Updated",
  "phone": "+966500000001",
  "notes": "VIP customer - Gold tier",
  "isFavorite": true
}
```

### Delete Player
```
DELETE /api/merchant/players/:id
```

### Add Game Account to Player
```
POST /api/merchant/players/:id/accounts
```

**Body:**
```json
{
  "gameKey": "pubg",
  "accountIdentifier": "5123456789",
  "label": "Main Account"
}
```

### Remove Game Account
```
DELETE /api/merchant/players/:id/accounts/:accountId
```

### Get Player Orders
```
GET /api/merchant/players/:id/orders
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

---

## 5. Products & Categories

### Get Categories
```
GET /api/merchant/products/categories
```

**Response:**
```json
[
  {
    "id": "category_id",
    "name": "Game Cards",
    "nameAr": "بطاقات الألعاب",
    "slug": "game-cards",
    "icon": "🎮",
    "parentId": null,
    "sortOrder": 0,
    "isActive": true
  }
]
```

### List Products
```
GET /api/merchant/products
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| categoryId | string | Filter by category |
| brandId | string | Filter by brand |
| q | string | Search by name |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "data": [
    {
      "id": "product_id",
      "name": "PUBG UC 600",
      "nameAr": "شدات ببجي 600",
      "image": "https://...",
      "denomination": 600,
      "currency": "SAR",
      "wholesalePrice": 85,
      "retailPrice": 100,
      "minQuantity": 1,
      "maxQuantity": 100,
      "isActive": true,
      "isAvailable": true,
      "availableStock": 50,
      "brand": {
        "id": "brand_id",
        "name": "PUBG Mobile"
      }
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

### Get Product Details
```
GET /api/merchant/products/:id
```

**Response:**
```json
{
  "id": "product_id",
  "name": "PUBG UC 600",
  "nameAr": "شدات ببجي 600",
  "description": "600 Unknown Cash for PUBG Mobile",
  "descriptionAr": "600 شدة لببجي موبايل",
  "image": "https://...",
  "denomination": 600,
  "currency": "SAR",
  "wholesalePrice": 85,
  "retailPrice": 100,
  "profitMargin": 15,
  "taxRate": 0.15,
  "minQuantity": 1,
  "maxQuantity": 100,
  "isActive": true,
  "isAvailable": true,
  "availableStock": 50,
  "brand": {
    "id": "brand_id",
    "name": "PUBG Mobile",
    "nameAr": "ببجي موبايل",
    "logo": "https://..."
  },
  "category": {
    "id": "category_id",
    "name": "Game Cards",
    "nameAr": "بطاقات الألعاب"
  }
}
```

### Get Product Price History
```
GET /api/merchant/products/:id/price-history
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Number of records (default: 30) |

**Response:**
```json
[
  {
    "id": "history_id",
    "oldPrice": 90,
    "newPrice": 85,
    "changePercent": "-5.6",
    "changedAt": "2024-01-15T00:00:00.000Z",
    "reason": "Supplier discount"
  }
]
```

---

## 6. Cart

### Get Cart
```
GET /api/merchant/cart
```

**Response:**
```json
{
  "cartId": "cart_id",
  "currency": "SAR",
  "items": [
    {
      "id": "item_id",
      "productId": "product_id",
      "productName": "PUBG UC 600",
      "productNameAr": "شدات ببجي 600",
      "productImage": "https://...",
      "qty": 5,
      "effectiveUnitPrice": 85,
      "lineTotal": 425,
      "minQty": 1,
      "maxQty": 100,
      "availableStock": 50,
      "metadata": {
        "playerId": "player_id",
        "accountIdentifier": "5123456789"
      }
    }
  ],
  "totals": {
    "subtotal": 425,
    "discountTotal": 0,
    "feesTotal": 0,
    "taxTotal": 63.75,
    "total": 488.75
  }
}
```

### Add/Update Cart Item
```
POST /api/merchant/cart/items
```

**Body:**
```json
{
  "productId": "product_id",
  "qty": 5,
  "metadata": {
    "playerId": "player_id",
    "accountIdentifier": "5123456789"
  }
}
```

> **Note:** Set `qty: 0` to remove the item.

### Update Cart Item Quantity
```
PATCH /api/merchant/cart/items/:itemId
```

**Body:**
```json
{
  "qty": 10
}
```

### Remove Cart Item
```
DELETE /api/merchant/cart/items/:itemId
```

### Clear Cart
```
POST /api/merchant/cart/clear
```

**Response:**
```json
{
  "ok": true
}
```

---

## 7. Orders

### List Orders
```
GET /api/merchant/orders
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| paymentStatus | string | `UNPAID`, `PENDING`, `PAID`, `REFUNDED` |
| from | string | Start date (ISO format) |
| to | string | End date (ISO format) |
| playerId | string | Filter by player |
| q | string | Search by order number |
| cursor | string | Pagination cursor |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "items": [
    {
      "id": "order_id",
      "orderNumber": "MO-ABC123-XYZ",
      "status": "COMPLETED",
      "paymentStatus": "PAID",
      "paymentMethod": "WALLET",
      "source": "CART",
      "total": 488.75,
      "currency": "SAR",
      "itemsCount": 2,
      "playerName": "Ahmed Ali",
      "createdAt": "2024-01-15T00:00:00.000Z",
      "completedAt": "2024-01-15T00:01:00.000Z"
    }
  ],
  "nextCursor": "next_cursor_id"
}
```

### Create Order (Cart Checkout)
```
POST /api/merchant/orders
```

**Headers:**
```
Idempotency-Key: unique_request_key
```

**Body (Cart Checkout):**
```json
{
  "source": "cart",
  "cartId": "cart_id",
  "playerId": "player_id",
  "paymentMethod": "wallet",
  "notes": "Order notes"
}
```

**Body (Quick Recharge):**
```json
{
  "source": "quick_recharge",
  "items": [
    {
      "productId": "product_id",
      "qty": 1,
      "accountIdentifier": "5123456789"
    }
  ],
  "playerId": "player_id",
  "paymentMethod": "wallet"
}
```

**Response:**
```json
{
  "id": "order_id",
  "orderNumber": "MO-ABC123-XYZ",
  "status": "COMPLETED",
  "paymentStatus": "PAID",
  "paymentMethod": "WALLET",
  "source": "CART",
  "subtotal": 425,
  "discountTotal": 0,
  "feesTotal": 0,
  "taxTotal": 63.75,
  "total": 488.75,
  "profitTotal": 75,
  "currency": "SAR",
  "items": [
    {
      "id": "item_id",
      "productId": "product_id",
      "productName": "PUBG UC 600",
      "quantity": 5,
      "unitPrice": 85,
      "lineTotal": 425,
      "deliveries": [
        {
          "cardCode": "XXXX-XXXX-XXXX-XXXX",
          "cardPin": "1234",
          "deliveredAt": "2024-01-15T00:01:00.000Z"
        }
      ]
    }
  ],
  "events": [...],
  "invoice": {
    "id": "invoice_id",
    "invoiceNumber": "INV-2024-000001",
    "issuedAt": "2024-01-15T00:01:00.000Z"
  },
  "createdAt": "2024-01-15T00:00:00.000Z",
  "completedAt": "2024-01-15T00:01:00.000Z"
}
```

### Get Order Details
```
GET /api/merchant/orders/:id
```

### Cancel Order
```
POST /api/merchant/orders/:id/cancel
```

**Body:**
```json
{
  "reason": "Customer request"
}
```

**Response:**
```json
{
  "ok": true
}
```

### Reorder
```
POST /api/merchant/orders/:id/reorder
```

**Body:**
```json
{
  "paymentMethod": "wallet",
  "playerId": "player_id",
  "useLatestPrices": true
}
```

### Submit Bank Transfer Proof
```
POST /api/merchant/orders/:id/submit-bank-transfer-proof
```

**Body:**
```json
{
  "paymentIntentId": "intent_id",
  "proofAttachmentUrl": "https://example.com/receipt.jpg",
  "note": "Transfer completed at 2:30 PM"
}
```

**Response:**
```json
{
  "ok": true,
  "status": "PENDING_REVIEW"
}
```

---

## 8. Favorites

### List Favorites
```
GET /api/merchant/favorites
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | `product` or `player` |

**Response:**
```json
[
  {
    "id": "favorite_id",
    "type": "product",
    "refId": "product_id",
    "snapshot": {
      "id": "product_id",
      "name": "PUBG UC 600",
      "nameAr": "شدات ببجي 600",
      "image": "https://...",
      "wholesalePrice": 85,
      "currency": "SAR",
      "brandName": "PUBG Mobile"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Add Favorite
```
POST /api/merchant/favorites
```

**Body:**
```json
{
  "type": "product",
  "refId": "product_id"
}
```

### Remove Favorite
```
DELETE /api/merchant/favorites
```

**Body:**
```json
{
  "type": "product",
  "refId": "product_id"
}
```

---

## 9. Promotions

### List Promotions
```
GET /api/merchant/promotions
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | `active`, `upcoming`, `expired` |

**Response:**
```json
[
  {
    "id": "promotion_id",
    "titleEn": "Buy 100 cards, get 10% cashback",
    "titleAr": "اشتر 100 بطاقة واحصل على 10% استرداد",
    "descriptionEn": "Complete 100 orders this month",
    "type": "VOLUME_BASED",
    "status": "ACTIVE",
    "startAt": "2024-01-01T00:00:00.000Z",
    "endAt": "2024-01-31T23:59:59.000Z",
    "imageUrl": "https://...",
    "conditions": {
      "minOrders": 100
    },
    "benefit": {
      "type": "cashback_percent",
      "value": 10,
      "maxDiscount": 1000
    },
    "progress": {
      "promotionId": "promotion_id",
      "progress": {
        "ordersCount": 45
      },
      "isCompleted": false,
      "rewardClaimed": false
    }
  }
]
```

### Get Promotion Details
```
GET /api/merchant/promotions/:id
```

### Get Promotion Progress
```
GET /api/merchant/promotions/:id/progress
```

**Response:**
```json
{
  "promotionId": "promotion_id",
  "progress": {
    "ordersCount": 45,
    "volume": 15000,
    "currentValue": 45,
    "targetValue": 100,
    "percentage": 45
  },
  "isCompleted": false,
  "completedAt": null,
  "estimatedReward": 1500,
  "rewardClaimed": false
}
```

---

## 10. Price Alerts

### List Price Alerts
```
GET /api/merchant/price-alerts
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| productId | string | Filter by product |
| alertType | string | `any_change`, `drop_only`, `rise_only` |

**Response:**
```json
[
  {
    "id": "alert_id",
    "productId": "product_id",
    "productName": "PUBG UC 600",
    "productNameAr": "شدات ببجي 600",
    "productImage": "https://...",
    "currentPrice": 85,
    "alertType": "drop_only",
    "isActive": true,
    "lastNotifiedAt": "2024-01-10T00:00:00.000Z",
    "lastNotifiedPrice": 90,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Create Price Alert
```
POST /api/merchant/price-alerts
```

**Body:**
```json
{
  "productId": "product_id",
  "alertType": "drop_only"
}
```

### Delete Price Alert
```
DELETE /api/merchant/price-alerts/:id
```

### Toggle Price Alert
```
POST /api/merchant/price-alerts/:id/toggle
```

**Response:**
```json
{
  "ok": true,
  "isActive": false
}
```

---

## 11. Notifications

### List Notifications
```
GET /api/merchant/notifications
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unreadOnly | boolean | Filter unread only |
| cursor | string | Pagination cursor |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "items": [
    {
      "id": "notification_id",
      "type": "ORDER_STATUS",
      "titleEn": "Order MO-ABC123 has been completed",
      "titleAr": "تم إكمال الطلب MO-ABC123",
      "bodyEn": "Your order MO-ABC123 has been completed",
      "bodyAr": "تم إكمال طلبك MO-ABC123",
      "data": {
        "orderId": "order_id",
        "orderNumber": "MO-ABC123",
        "status": "COMPLETED"
      },
      "readAt": null,
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "nextCursor": "next_cursor_id"
}
```

### Get Unread Count
```
GET /api/merchant/notifications/unread-count
```

**Response:**
```json
{
  "count": 5
}
```

### Mark as Read
```
POST /api/merchant/notifications/:id/read
```

**Response:**
```json
{
  "ok": true,
  "readAt": "2024-01-15T00:00:00.000Z"
}
```

### Mark All as Read
```
POST /api/merchant/notifications/read-all
```

**Response:**
```json
{
  "ok": true
}
```

---

## 12. Invoices

### List Invoices
```
GET /api/merchant/invoices
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| from | string | Start date (ISO format) |
| to | string | End date (ISO format) |
| status | string | `ISSUED`, `VOIDED`, `REFUNDED` |
| cursor | string | Pagination cursor |
| limit | number | Items per page (default: 20) |

**Response:**
```json
{
  "items": [
    {
      "id": "invoice_id",
      "invoiceNumber": "INV-2024-000001",
      "orderNumber": "MO-ABC123-XYZ",
      "orderId": "order_id",
      "status": "ISSUED",
      "currency": "SAR",
      "totals": {
        "subtotal": 425,
        "discountTotal": 0,
        "feesTotal": 0,
        "taxTotal": 63.75,
        "total": 488.75
      },
      "issuedAt": "2024-01-15T00:00:00.000Z",
      "orderDate": "2024-01-15T00:00:00.000Z"
    }
  ],
  "nextCursor": "next_cursor_id"
}
```

### Get Invoice Details
```
GET /api/merchant/invoices/:id
```

**Response:**
```json
{
  "id": "invoice_id",
  "invoiceNumber": "INV-2024-000001",
  "orderNumber": "MO-ABC123-XYZ",
  "orderId": "order_id",
  "status": "ISSUED",
  "currency": "SAR",
  "issuedAt": "2024-01-15T00:00:00.000Z",
  "orderDate": "2024-01-15T00:00:00.000Z",
  "merchant": {
    "id": "merchant_id",
    "businessName": "My Game Shop",
    "businessNameAr": "متجر الألعاب",
    "phone": "+966500000000",
    "email": "merchant@example.com"
  },
  "buyer": {
    "id": "player_id",
    "name": "Ahmed Ali",
    "phone": "+966500000000"
  },
  "items": [
    {
      "productId": "product_id",
      "productName": "PUBG UC 600",
      "productNameAr": "شدات ببجي 600",
      "quantity": 5,
      "unitPrice": 85,
      "lineTotal": 425
    }
  ],
  "totals": {
    "subtotal": 425,
    "discountTotal": 0,
    "feesTotal": 0,
    "taxTotal": 63.75,
    "total": 488.75
  },
  "payment": {
    "method": "WALLET",
    "status": "PAID"
  }
}
```

---

## 13. Dashboard & Reports

### Dashboard Home
```
GET /api/merchant/dashboard/home
```

**Response:**
```json
{
  "walletBalance": 5000,
  "currency": "SAR",
  "todayOrdersCount": 12,
  "todayProfit": 450,
  "pendingOrdersCount": 2,
  "topSellingProducts": [
    {
      "productId": "product_id",
      "name": "PUBG UC 600",
      "nameAr": "شدات ببجي 600",
      "image": "https://...",
      "qty": 150,
      "revenue": 12750,
      "profit": 2250
    }
  ],
  "recentOrders": [
    {
      "id": "order_id",
      "orderNumber": "MO-ABC123-XYZ",
      "status": "COMPLETED",
      "total": 488.75,
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "activePromotions": [
    {
      "id": "promotion_id",
      "title": "Buy 100 cards, get 10% cashback",
      "titleAr": "اشتر 100 بطاقة واحصل على 10% استرداد",
      "progressPercentage": 45,
      "endsAt": "2024-01-31T23:59:59.000Z"
    }
  ],
  "unreadNotificationsCount": 3
}
```

### Profit Report
```
GET /api/merchant/dashboard/reports/profit
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| range | string | `today`, `week`, `month`, `total` |
| from | string | Start date (ISO format) |
| to | string | End date (ISO format) |

**Response:**
```json
{
  "profitTotal": 15000,
  "revenueTotal": 75000,
  "ordersCount": 250,
  "currency": "SAR",
  "breakdown": [
    {
      "date": "2024-01-15",
      "profit": 450,
      "revenue": 2500,
      "ordersCount": 8
    }
  ]
}
```

### Top Profitable Products
```
GET /api/merchant/dashboard/reports/top-profitable-products
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| range | string | `today`, `week`, `month`, `total` |
| from | string | Start date (ISO format) |
| to | string | End date (ISO format) |
| limit | number | Number of products (default: 10) |

**Response:**
```json
{
  "products": [
    {
      "productId": "product_id",
      "name": "PUBG UC 600",
      "nameAr": "شدات ببجي 600",
      "image": "https://...",
      "profit": 5000,
      "qty": 350,
      "revenue": 29750
    }
  ]
}
```

### Price Changes Report
```
GET /api/merchant/dashboard/reports/price-changes
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| productId | string | Filter by product |
| from | string | Start date (ISO format) |
| to | string | End date (ISO format) |

**Response:**
```json
{
  "changes": [
    {
      "productId": "product_id",
      "productName": "PUBG UC 600",
      "productNameAr": "شدات ببجي 600",
      "oldPrice": 90,
      "newPrice": 85,
      "changePercent": -5.56,
      "changedAt": "2024-01-15T00:00:00.000Z",
      "reason": "Supplier discount"
    }
  ]
}
```

### Audit Logs
```
GET /api/merchant/dashboard/audit-logs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| from | string | Start date (ISO format) |
| to | string | End date (ISO format) |
| actorUserId | string | Filter by user |
| action | string | Filter by action |
| cursor | string | Pagination cursor |
| limit | number | Items per page (default: 50) |

**Response:**
```json
{
  "items": [
    {
      "id": "log_id",
      "actorType": "MERCHANT",
      "actorUserId": "user_id",
      "actorEmployeeId": null,
      "employeeName": null,
      "action": "order.created",
      "entityType": "MerchantOrder",
      "entityId": "order_id",
      "metadata": {
        "orderNumber": "MO-ABC123",
        "total": 488.75
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ],
  "nextCursor": "next_cursor_id"
}
```

---

## 14. Sessions

### List Active Sessions
```
GET /api/merchant/sessions
```

**Response:**
```json
[
  {
    "id": "session_id",
    "deviceId": "device_unique_id",
    "deviceName": "iPhone 15 Pro",
    "platform": "ios",
    "ipAddress": "192.168.1.1",
    "isTrusted": true,
    "employeeName": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastSeenAt": "2024-01-15T12:00:00.000Z"
  }
]
```

### Trust/Untrust Session
```
PATCH /api/merchant/sessions/:id/trust
```

**Body:**
```json
{
  "isTrusted": true
}
```

**Response:**
```json
{
  "ok": true,
  "isTrusted": true
}
```

### Revoke Session
```
DELETE /api/merchant/sessions/:id
```

**Response:**
```json
{
  "ok": true
}
```

---

## Error Responses

All endpoints may return the following error format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Permission denied |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 500 | Internal Server Error |

### Business Error Codes

| Code | Description |
|------|-------------|
| `INSUFFICIENT_WALLET_BALANCE` | Not enough wallet balance |
| `PRODUCT_DISABLED` | Product is not available |
| `QTY_OUT_OF_RANGE` | Quantity outside allowed range |
| `CART_EMPTY` | Cart has no items |
| `INVALID_STATE` | Order state doesn't allow this action |
| `DUPLICATE_ACCOUNT` | Game account already exists |
| `ALREADY_EXISTS` | Resource already exists |
| `EMPLOYEE_USERNAME_TAKEN` | Username is taken |

---

## Postman Environment Variables

```json
{
  "baseUrl": "http://localhost:3002",
  "accessToken": "your_jwt_token",
  "tenantId": "your_tenant_id",
  "merchantId": "",
  "cartId": "",
  "orderId": "",
  "playerId": ""
}
```

---

## Permission Reference

| Permission | Description |
|------------|-------------|
| `ordersCreate` | Create new orders |
| `ordersRead` | View orders list and details |
| `reportsRead` | View profit reports and analytics |
| `walletRead` | View wallet balance |
| `playersWrite` | Create, update, delete players |
| `employeesManage` | Manage employees (owner only) |
| `settingsWrite` | Update merchant settings |
| `invoicesRead` | View invoices |

---

*Generated for Merchant Dealer App v1.0*

