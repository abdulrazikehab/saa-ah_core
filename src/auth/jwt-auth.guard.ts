import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
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
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
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