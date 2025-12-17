import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';

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
  private readonly logger = new Logger(TenantRequiredGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Check if tenant ID is available from multiple sources:
    // 1. The request context (set by TenantMiddleware from subdomain/domain)
    // 2. The authenticated user's active tenant
    // DO NOT use user.id as fallback - it's not a valid tenant ID
    const tenantId = request.tenantId || request.user?.tenantId;
    
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      this.logger.warn('TenantRequiredGuard: No valid tenantId found', {
        tenantId,
        hasTenantId: !!request.tenantId,
        hasUserTenantId: !!request.user?.tenantId,
        hasUserId: !!request.user?.id,
        user: request.user,
        path: request.url,
        method: request.method
      });
      throw new ForbiddenException(
        'You must set up a market first before performing this action. Please go to Market Setup to create your store. If you have already set up a market, please log out and log back in to refresh your session.'
      );
    }
    
    return true;
  }
}

