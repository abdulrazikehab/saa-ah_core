import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActionLoggingInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const user = (request as any).user;
    const ipAddress = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Skip logging for certain endpoints
    const skipPaths = ['/api/health', '/api/admin/master', '/api/activity-logs'];
    if (skipPaths.some(path => url.includes(path))) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // Log all successful actions (TransformInterceptor only wraps successful responses)
          // If response has success:true or is a valid object, it's a successful request
          const isSuccess = response && (
            (typeof response === 'object' && response.success === true) ||
            (typeof response === 'object' && !('statusCode' in response) && !('error' in response)) ||
            (typeof response === 'object' && 'statusCode' in response && response.statusCode >= 200 && response.statusCode < 300)
          );

          if (isSuccess && this.prisma.activityLog) {
            // Log all successful actions (all methods including GET)
            await this.prisma.activityLog.create({
              data: {
                tenantId: user?.tenantId || request.headers['x-tenant-id'] as string || 'system',
                actorId: user?.id || user?.sub || 'system',
                action: `${method} ${url.split('?')[0]}`,
                targetId: params?.id || query?.id || body?.id || 'system',
                details: {
                  method,
                  url,
                  body: this.sanitizeBody(body),
                  query,
                  params,
                  ipAddress,
                  userAgent,
                  resourceType: this.getResourceType(url),
                  userEmail: user?.email,
                  userName: user?.name,
                },
              },
            });
          }
        } catch (error) {
          // Silent fail - don't break request if logging fails
        }
      }),
    );
  }

  private getResourceType(url: string): string {
    if (url.includes('/products')) return 'PRODUCT';
    if (url.includes('/orders')) return 'ORDER';
    if (url.includes('/categories')) return 'CATEGORY';
    if (url.includes('/cart')) return 'CART';
    if (url.includes('/checkout')) return 'CHECKOUT';
    if (url.includes('/pages')) return 'PAGE';
    if (url.includes('/theme')) return 'THEME';
    if (url.includes('/settings')) return 'SETTINGS';
    if (url.includes('/site-config')) return 'SETTINGS';
    if (url.includes('/domain')) return 'DOMAIN';
    if (url.includes('/templates')) return 'TEMPLATE';
    if (url.includes('/collections')) return 'COLLECTION';
    if (url.includes('/coupons')) return 'COUPON';
    if (url.includes('/shipping')) return 'SHIPPING';
    if (url.includes('/tax')) return 'TAX';
    if (url.includes('/customers')) return 'CUSTOMER';
    if (url.includes('/dashboard')) return 'DASHBOARD';
    if (url.includes('/analytics')) return 'ANALYTICS';
    if (url.includes('/reports')) return 'REPORT';
    if (url.includes('/transactions')) return 'TRANSACTION';
    if (url.includes('/payment')) return 'PAYMENT';
    return 'SYSTEM';
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    // Remove sensitive fields
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.token) sanitized.token = '[REDACTED]';
    if (sanitized.secret) sanitized.secret = '[REDACTED]';
    return sanitized;
  }
}

