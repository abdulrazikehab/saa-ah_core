// apps/app-core/src/upload/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Request,
  BadRequestException,
  Delete,
  Body,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';
import { CloudinaryService, CloudinaryUploadResponse } from '../cloudinary/cloudinary.service';
import { AuthenticatedRequest } from '../types/request.types';
import { validateFileSafety } from '../utils/file-validation.util';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private cloudinaryService: CloudinaryService) {}

  @Post('test-connection')
  async testConnection(): Promise<{ message: string; connected: boolean }> {
    try {
      const isConnected = await this.cloudinaryService.testConnection();
      return {
        message: isConnected ? 'Cloudinary connection successful' : 'Cloudinary connection failed',
        connected: isConnected,
      };
    } catch (error) {
      this.logger.error('Cloudinary connection test failed:', error);
      throw new BadRequestException('Cloudinary connection test failed');
    }
  }

  @Post('images')
  @UseGuards(TenantRequiredGuard)
  @UseInterceptors(FilesInterceptor('files', 10, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      // Validate file types
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type ${file.mimetype} is not allowed`), false);
      }
    },
  }))
  async uploadImages(
    @Request() req: AuthenticatedRequest,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ 
    message: string; 
    files: CloudinaryUploadResponse[] 
  }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Validate file safety (Magic Numbers)
    files.forEach(file => validateFileSafety(file));

    // Get tenantId from multiple sources
    const tenantId = req.user?.tenantId || req.tenantId;
    
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      this.logger.error('Upload failed: Invalid tenantId', {
        tenantId,
        hasUserTenantId: !!req.user?.tenantId,
        hasReqTenantId: !!req.tenantId,
      });
      throw new ForbiddenException(
        'You must set up a market first before uploading images. Please go to Market Setup to create your store.'
      );
    }

    this.logger.log(`Uploading ${files.length} images for tenant ${tenantId}`);

    try {
      const uploadResults = await this.cloudinaryService.uploadMultipleImages(
        files,
        `tenants/${tenantId}/products`
      );

      this.logger.log(`Successfully uploaded ${uploadResults.length} images`);

      return {
        message: `${uploadResults.length} files uploaded successfully`,
        files: uploadResults,
      };
    } catch (error: any) {
      this.logger.error('File upload failed:', error);
      throw new BadRequestException(`File upload failed: ${error?.message || 'Unknown error'}`);
    }
  }

  @Delete('images')
  async deleteImage(
    @Body() body: { publicId: string },
  ): Promise<{ message: string }> {
    if (!body.publicId) {
      throw new BadRequestException('Public ID is required');
    }

    this.logger.log(`Deleting image with public ID: ${body.publicId}`);

    try {
      await this.cloudinaryService.deleteImage(body.publicId);
      return { message: 'Image deleted successfully' };
    } catch (error) {
      this.logger.error('Failed to delete image:', error);
      throw new BadRequestException(`Failed to delete image: ${error}`);
    }
  }

  @Post('product-images')
  @UseGuards(TenantRequiredGuard)
  @UseInterceptors(FilesInterceptor('images', 10, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type ${file.mimetype} is not allowed for product images`), false);
      }
    },
  }))
  async uploadProductImages(
    @Request() req: AuthenticatedRequest,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images uploaded');
    }

    // Validate file safety (Magic Numbers)
    files.forEach(file => validateFileSafety(file));

    // Get tenantId from multiple sources
    const tenantId = req.user?.tenantId || req.tenantId;
    
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      this.logger.error('Product image upload failed: Invalid tenantId', {
        tenantId,
        hasUserTenantId: !!req.user?.tenantId,
        hasReqTenantId: !!req.tenantId,
      });
      throw new ForbiddenException(
        'You must set up a market first before uploading images. Please go to Market Setup to create your store.'
      );
    }

    this.logger.log(`Uploading ${files.length} product images for tenant ${tenantId}`);

    try {
      const uploadResults = await this.cloudinaryService.uploadMultipleImages(
        files,
        `tenants/${tenantId}/products`
      );

      // Return with additional optimized URLs
      const enhancedResults = uploadResults.map(result => ({
        ...result,
        optimizedUrl: this.cloudinaryService.generateOptimizedUrl(result.publicId),
        thumbnailUrl: this.cloudinaryService.generateThumbnailUrl(result.publicId),
      }));

      this.logger.log(`Successfully uploaded ${enhancedResults.length} product images`);

      return {
        message: 'Product images uploaded successfully',
        images: enhancedResults,
      };
    } catch (error: any) {
      this.logger.error('Product image upload failed:', error);
      throw new BadRequestException(`Product image upload failed: ${error?.message || 'Unknown error'}`);
    }
  }
}