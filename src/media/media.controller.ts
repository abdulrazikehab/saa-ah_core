import {
  Controller,
  Get,
  Query,
  BadRequestException,
  BadGatewayException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  /**
   * GET /api/media/images
   * Fetch images from Cloudinary folders
   */
  @Get('images')
  async getImages(
    @Query('folder') folder?: string,
    @Query('folders') folders?: string,
    @Query('resource_type') resourceType?: string,
    @Query('limit') limit?: string,
    @Query('next_cursor') nextCursor?: string,
    @Query('next_cursors') nextCursors?: string,
    @Query('sort') sort?: string,
    @Query('fields') fields?: string,
  ) {
    try {
      // Validate that either folder or folders is provided (but not both)
      if (!folder && !folders) {
        throw new BadRequestException("Either 'folder' or 'folders' parameter is required.");
      }

      if (folder && folders) {
        throw new BadRequestException("Cannot use both 'folder' and 'folders' parameters. Use one or the other.");
      }

      const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;
      const parsedSort = (sort === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
      const parsedFields = fields ? fields.split(',').map((f) => f.trim()) : undefined;

      // Single folder
      if (folder) {
        try {
          const result = await this.cloudinaryService.getImagesFromFolder(folder, {
            resourceType: resourceType || 'image',
            limit: parsedLimit,
            nextCursor,
            sort: parsedSort,
            fields: parsedFields,
          });

          return {
            success: true,
            folder: result.folder,
            count: result.count,
            image_count: result.count,
            total_image_count: result.totalCount,
            data: result.data,
            ...(result.nextCursor && { next_cursor: result.nextCursor }),
          };
        } catch (error: any) {
          this.logger.error(`Error fetching images from folder ${folder}:`, error);
          throw new BadGatewayException(`Cloudinary API error: ${error.message || 'Unknown error'}`);
        }
      }

      // Multiple folders
      if (folders) {
        try {
          const folderList = folders.split(',').map((f) => f.trim()).filter(Boolean);
          
          if (folderList.length === 0) {
            throw new BadRequestException('Invalid folders parameter. Provide comma-separated folder paths.');
          }

          // Parse next_cursors if provided
          let parsedNextCursors: Record<string, string> = {};
          if (nextCursors) {
            try {
              parsedNextCursors = JSON.parse(decodeURIComponent(nextCursors));
            } catch (parseError) {
              this.logger.warn('Failed to parse next_cursors, ignoring:', parseError);
            }
          }

          const result = await this.cloudinaryService.getImagesFromFolders(folderList, {
            resourceType: resourceType || 'image',
            limit: parsedLimit,
            nextCursors: parsedNextCursors,
            sort: parsedSort,
            fields: parsedFields,
          });

          return {
            success: true,
            folders: result.folders,
            count: result.count,
            image_count: result.count,
            total_image_count: result.totalCount,
            data: result.data,
            ...(Object.keys(result.nextCursors).length > 0 && {
              next_cursors: result.nextCursors,
            }),
          };
        } catch (error: any) {
          this.logger.error(`Error fetching images from folders ${folders}:`, error);
          throw new BadGatewayException(`Cloudinary API error: ${error.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.error('Unexpected error in getImages:', error);
      throw new BadGatewayException(`Failed to fetch images: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * GET /api/media/folders
   * List available folders/subfolders
   * Defaults to "Asus" folder's subfolders if no root is provided
   */
  @Get('folders')
  async listFolders(@Query('root') root?: string) {
    try {
      // Default to "Asus" if no root is provided
      const targetRoot = root || 'Asus';
      
      // Get subfolders under the target root (only subfolders, not the root itself)
      const folders = await this.cloudinaryService.listFolders(targetRoot);

      return {
        success: true,
        root: targetRoot,
        folders,
      };
    } catch (error: any) {
      this.logger.error(`Error listing folders${root ? ` under ${root}` : ' (default: Asus)'}:`, error);
      throw new BadGatewayException(`Cloudinary API error: ${error.message || 'Unknown error'}`);
    }
  }
}

