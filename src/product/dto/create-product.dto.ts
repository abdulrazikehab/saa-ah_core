// apps/app-core/src/product/dto/create-product.dto.ts
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  compareAtPrice?: number;

  @IsNumber()
  @Min(0)
  inventoryQuantity!: number;
}

export class ProductImageDto {
  @IsString()
  url!: string;

  @IsString()
  @IsOptional()
  altText?: string;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  nameAr?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  descriptionAr?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  compareAtPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPerItem?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  dimensions?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  @IsOptional()
  images?: ProductImageDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  productCode?: string;

  @IsString()
  @IsOptional()
  odooProductId?: string;

  @IsString()
  @IsOptional()
  brandId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supplierIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSupplierDto)
  @IsOptional()
  suppliers?: ProductSupplierDto[];

  @IsString()
  @IsOptional()
  unitId?: string;
}

export class ProductSupplierDto {
  @IsString()
  supplierId!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountRate?: number;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}