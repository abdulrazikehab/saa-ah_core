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
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CloudinaryService, CloudinaryUploadResponse } from '../cloudinary/cloudinary.service';

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
    @Request() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<{ 
    message: string; 
    files: CloudinaryUploadResponse[] 
  }> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    this.logger.log(`Uploading ${files.length} images for tenant ${req.tenantId}`);

    try {
      const uploadResults = await this.cloudinaryService.uploadMultipleImages(
        files,
        `tenants/${req.tenantId}/products`
      );

      this.logger.log(`Successfully uploaded ${uploadResults.length} images`);

      return {
        message: `${uploadResults.length} files uploaded successfully`,
        files: uploadResults,
      };
    } catch (error) {
      this.logger.error('File upload failed:', error);
      throw new BadRequestException(`File upload failed: ${error}`);
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
    @Request() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images uploaded');
    }

    this.logger.log(`Uploading ${files.length} product images for tenant ${req.tenantId}`);

    const uploadResults = await this.cloudinaryService.uploadMultipleImages(
      files,
      `tenants/${req.tenantId}/products`
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
  }
}