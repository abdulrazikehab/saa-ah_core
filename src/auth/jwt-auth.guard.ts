import { Injectable, ExecutionContext, UnauthorizedException, CanActivate, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ApiKeyService } from '../api-key/api-key.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional() private readonly apiKeyService?: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    
    // Check for API key first (X-API-Key header) - only if ApiKeyService is available
    const apiKey = request.headers['x-api-key'] || request.headers['x-apikey'];
    if (apiKey && this.apiKeyService) {
      try {
        const apiKeyInfo = await this.apiKeyService.validateApiKey(apiKey);
        if (apiKeyInfo) {
          // Set user context for API key authentication
          request.user = {
            id: `api-key-${apiKeyInfo.apiKeyId}`,
            tenantId: apiKeyInfo.tenantId,
            role: 'API_CLIENT',
            email: null,
          };
          request.tenantId = apiKeyInfo.tenantId;
          return true;
        }
      } catch (error) {
        // If API key validation fails, continue to JWT check
      }
    }

    const token = this.extractTokenFromHeader(request);

    if (isPublic) {
      // For public routes, try to extract user info if token is present
      // This allows public endpoints to return user-specific data (like tenant content)
      if (token) {
        try {
          const secret = this.configService.get<string>('JWT_SECRET');
          if (secret) {
            const payload = this.jwtService.verify(token, { secret });
            request.user = {
              id: payload.sub,
              tenantId: payload.tenantId || null,
              role: payload.role,
              email: payload.email
            };
            request.tenantId = payload.tenantId || null;
          }
        } catch (error) {
          // Ignore token errors for public routes
        }
      }
      return true;
    }
    
    // If no API key was provided and route is not public, require JWT token
    if (!token) {
      throw new UnauthorizedException('No authentication token or API key provided');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const payload = this.jwtService.verify(token, { secret });
      
      // Allow users without tenantId (for tenant setup flow)
      // The tenantId will be null for newly registered users who haven't set up their tenant yet
      request.user = {
        id: payload.sub,
        tenantId: payload.tenantId || null,
        role: payload.role,
        email: payload.email
      };
      request.tenantId = payload.tenantId || null;
      return true;
    } catch (error) {
      // Re-throw authentication errors
      throw error;
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    // Try cookie first, then Authorization header
    if (request?.cookies?.accessToken) {
      return request.cookies.accessToken;
    }
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}