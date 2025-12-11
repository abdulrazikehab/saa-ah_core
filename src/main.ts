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

    app.setGlobalPrefix('api');
    
    // Verify JWT secret is loaded
    if (!process.env.JWT_SECRET) {
      logger.error('❌ JWT_SECRET is not configured in environment variables');
      process.exit(1);
    }

  // Enhanced CORS configuration for frontend and subdomains
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // List of allowed origins
      const allowedOrigins = [
        'http://localhost:4173',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:4173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
        'http://192.168.0.108:4173',
        'http://192.168.0.108:8080',
        process.env.FRONTEND_URL,
      ].filter(Boolean);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Allow any subdomain of localhost (e.g., mystore.localhost:8080)
      if (origin.match(/^http:\/\/[\w-]+\.localhost(:\d+)?$/)) {
        return callback(null, true);
      }
      
      // Allow any subdomain of saa'ah.com
      if (origin.match(/^https?:\/\/[\w-]+\.saa'ah\.com$/)) {
        return callback(null, true);
      }

      // Allow local network IPs (e.g. 192.168.1.12:4173)
      if (origin.match(/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/)) {
        return callback(null, true);
      }
      
      // Reject other origins
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'X-Tenant-Id',
      'X-Tenant-Domain',
      'X-Session-ID',
      'X-Admin-API-Key'
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
    await app.listen(port);
    logger.log(`✅ app-core listening on port ${port}`);
  } catch (error) {
    logger.error('Failed to start core service:', error);
    process.exit(1);
  }
}

bootstrap();