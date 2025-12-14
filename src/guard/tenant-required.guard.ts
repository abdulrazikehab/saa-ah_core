import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Guard that ensures the user has a valid tenant selected.
 * Used to protect endpoints that require a market to be set up.
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, TenantRequiredGuard)
 * @Post()
 * create() { ... }
 */
@Injectable()
export class TenantRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check if tenant ID is available from either:
    // 1. The request context (set by TenantMiddleware from subdomain/domain)
    // 2. The authenticated user's active tenant
    const tenantId = request.tenantId || request.user?.tenantId;
    
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      throw new ForbiddenException(
        'You must set up a market first before performing this action. Please go to Market Setup to create your store.'
      );
    }
    
    return true;
  }
}

