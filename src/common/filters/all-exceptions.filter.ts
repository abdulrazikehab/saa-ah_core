import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private prisma: PrismaService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : exceptionResponse;
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    }

    // Save error to database using activityLog
    try {
      const user = (request as any).user;
      // Get tenant ID from user, request context, or header
      const tenantId = user?.tenantId || (request as any).tenantId || request.headers['x-tenant-id'] as string;
      
      // Only log if we have a valid tenant ID (foreign key constraint requires existing tenant)
      if (this.prisma.activityLog && tenantId && tenantId !== 'system') {
        await this.prisma.activityLog.create({
          data: {
            tenantId,
            actorId: user?.id || user?.sub || 'anonymous',
            action: 'ERROR',
            targetId: status.toString(),
            details: {
              severity: status >= 500 ? 'CRITICAL' : status >= 400 ? 'HIGH' : 'MEDIUM',
              message: typeof message === 'string' ? message : JSON.stringify(message),
              stack,
              method: request.method,
              path: request.url,
              statusCode: status,
              ipAddress: request.ip || request.connection?.remoteAddress,
              userAgent: request.headers['user-agent'],
              resourceType: 'SYSTEM',
              userEmail: user?.email,
              userName: user?.name,
            },
          },
        });
      }
    } catch (error) {
      // Silent fail - don't break error response if logging fails
    }

    // Send standardized error response
    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
