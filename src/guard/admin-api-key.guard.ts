import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  private cachedApiKey: string | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-admin-api-key'];
    
    if (!apiKey) {
      throw new UnauthorizedException('Admin API key is required');
    }

    // Get valid API key from database (with caching)
    const validApiKey = await this.getValidApiKey();
    
    if (apiKey === validApiKey) {
      return true;
    }
    
    throw new UnauthorizedException('Invalid admin API key');
  }

  private async getValidApiKey(): Promise<string> {
    const now = Date.now();
    
    // Return cached key if still valid
    if (this.cachedApiKey && now < this.cacheExpiry) {
      return this.cachedApiKey;
    }

    try {
      // Try to get from database
      const systemConfig = await this.prisma.siteConfig.findUnique({
        where: { tenantId: 'system' },
        select: { settings: true },
      });

      if (systemConfig?.settings && typeof systemConfig.settings === 'object') {
        const settings = systemConfig.settings as any;
        if (settings.adminApiKey) {
          this.cachedApiKey = settings.adminApiKey;
          this.cacheExpiry = now + this.CACHE_TTL;
          return this.cachedApiKey;
        }
      }
    } catch (error) {
      // Fall through to environment variable
    }

    // Fallback to environment variable
    const envKey = process.env.ADMIN_API_KEY || 'Saeaa2025Admin!';
    this.cachedApiKey = envKey;
    this.cacheExpiry = now + this.CACHE_TTL;
    return envKey;
  }
}
