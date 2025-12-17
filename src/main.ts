// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as path from 'path';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { securityConfig } from './config/security.config';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';

// Load environment variables first
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule);
    
    // Enable cookie parser
    app.use(cookieParser());
    
    // Increase body limit for image uploads
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));

    // Set global prefix to handle /api/api/... routes from frontend
    // Frontend calls /api/api/categories, backend receives /api/api/categories
    // With global prefix 'api', route becomes /api/categories which matches controller
    app.setGlobalPrefix('api');
    
    // Verify JWT secret is loaded
    if (!process.env.JWT_SECRET) {
      logger.error('❌ JWT_SECRET is not configured in environment variables');
      process.exit(1);
    }

    // CORS configuration - Allow all origins
    app.enableCors({
      origin: true, // Allow all origins
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-Tenant-Id',
        'X-Tenant-Domain',
        'x-tenant-id',
        'x-tenant-domain',
        'X-Session-ID',
        'x-session-id',
        'X-Admin-API-Key',
        'x-admin-api-key',
        'X-API-Key',
        'X-ApiKey',
        'x-api-key',
        'x-apikey'
      ],
      exposedHeaders: [
        'Content-Type',
        'Authorization',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Credentials'
      ],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    // Security Hardening
    app.use(helmet(securityConfig.helmet));
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    
    // Add global filter to log validation errors
    const { ValidationExceptionFilter } = await import('./common/filters/validation-exception.filter');
    app.useGlobalFilters(new ValidationExceptionFilter());

    const port = process.env.CORE_PORT || 3002;
    await app.listen(port,'0.0.0.0');
    logger.log(`✅ app-core listening on port ${port}`);
  } catch (error) {
    logger.error('Failed to start core service:', error);
    process.exit(1);
  }
}

bootstrap();