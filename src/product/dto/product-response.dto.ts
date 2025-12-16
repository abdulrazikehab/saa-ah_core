// apps/app-core/src/product/dto/product-response.dto.ts
export class ProductVariantResponseDto {
  id!: string;
  name!: string;
  sku?: string;
  price!: number;
  compareAtPrice?: number;
  inventoryQuantity!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ProductImageResponseDto {
  id!: string;
  url!: string;
  altText?: string;
  sortOrder!: number;
  createdAt!: Date;
}

export class ProductResponseDto {
  id!: string;
  tenantId!: string;
  name!: string;
  description?: string;
  sku?: string;
  price!: number;
  compareAtPrice?: number;
  costPerItem?: number;
  isAvailable!: boolean;
  isPublished?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  nameAr?: string;
  descriptionAr?: string;
  barcode?: string;
  featured?: boolean;
  weight?: number;
  dimensions?: string;
  createdAt!: Date;
  updatedAt!: Date;

  variants?: ProductVariantResponseDto[];
  images?: ProductImageResponseDto[];
  categories?: any[]; // We'll define CategoryResponseDto later
  productId?: string;
  productCode?: string;
  odooProductId?: string;
  brand?: {
    id: string;
    name: string;
    nameAr?: string;
    code?: string;
  };
  suppliers?: Array<{
    id: string;
    supplierId: string;
    supplier: {
      id: string;
      name: string;
      nameAr?: string;
      discountRate: number;
    };
    discountRate: number;
    isPrimary: boolean;
  }>;
  unit?: {
    id: string;
    name: string;
    nameAr?: string;
    code: string;
    symbol?: string;
    cost: number;
  };
}