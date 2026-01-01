// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import * as path from 'path';
import helmet from 'helmet';
import { ValidationPipe, Logger } from '@nestjs/common';
import { securityConfig } from './config/security.config';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import * as express from 'express';

// Load environment variables first
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    
    // CRITICAL: Enable CORS FIRST before any other middleware to prevent duplicate headers
    // Enhanced CORS configuration for frontend and subdomains
    // app.enableCors({
    //   origin: (origin, callback) => {
    //     // Allow requests with no origin (like mobile apps or curl requests)
    //     if (!origin) {
    //       logger.debug('✅ CORS: Allowing request with no origin');
    //       return callback(null, true);
    //     }
        
    //     logger.debug(`🔍 CORS: Checking origin: ${origin}`);
        
    //     // List of allowed origins
    //     const allowedOrigins = [
    //       'http://localhost:4173',
    //       'http://localhost:3000',
    //       'http://localhost:8080',
    //       'http://127.0.0.1:4173',
    //       'http://127.0.0.1:3000',
    //       'http://127.0.0.1:8080',
    //       'http://192.168.0.108:4173',
    //       'http://192.168.0.108:8080',
    //       'https://saeaa.com',
    //       'https://saeaa.net',
    //       'http://saeaa.com',
    //       'http://saeaa.net',
    //       'https://www.saeaa.com',
    //       'https://www.saeaa.net',
    //       'https://app.saeaa.com',
    //       'https://app.saeaa.net',
    //       process.env.FRONTEND_URL,
    //     ].filter(Boolean);
        
    //     // Check if origin is in allowed list
    //     if (allowedOrigins.includes(origin)) {
    //       logger.log(`✅ CORS: Allowed origin (whitelist): ${origin}`);
    //       return callback(null, origin); // Return origin string to prevent duplicates
    //     }
        
    //     // Allow any subdomain of localhost (e.g., mystore.localhost:8080)
    //     if (origin.match(/^http:\/\/[\w-]+\.localhost(:\d+)?$/)) {
    //       logger.log(`✅ CORS: Allowed origin (localhost subdomain): ${origin}`);
    //       return callback(null, origin);
    //     }
        
    //     // Allow main production domains (including www and app subdomains)
    //     if (origin.match(/^https?:\/\/(www\.|app\.)?(saeaa\.com|saeaa\.net)(:\d+)?$/)) {
    //       logger.log(`✅ CORS: Allowed origin (production domain): ${origin}`);
    //       return callback(null, origin);
    //     }
        
    //     // Allow any subdomain of saeaa.com (e.g., store.saeaa.com)
    //     if (origin.match(/^https?:\/\/[\w-]+\.saeaa\.com$/)) {
    //       logger.log(`✅ CORS: Allowed origin (saeaa.com subdomain): ${origin}`);
    //       return callback(null, origin);
    //     }
        
    //     // Allow any subdomain of saeaa.net (e.g., store.saeaa.net)
    //     if (origin.match(/^https?:\/\/[\w-]+\.saeaa\.net$/)) {
    //       logger.log(`✅ CORS: Allowed origin (saeaa.net subdomain): ${origin}`);
    //       return callback(null, origin);
    //     }
        
    //     // Legacy: Allow any subdomain of saa'ah.com (if still in use)
    //     if (origin.match(/^https?:\/\/[\w-]+\.saa'ah\.com$/)) {
    //       logger.log(`✅ CORS: Allowed origin (legacy domain): ${origin}`);
    //       return callback(null, origin);
    //     }

    //     // Allow local network IPs (e.g. 192.168.1.12:4173)
    //     if (origin.match(/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/)) {
    //       logger.log(`✅ CORS: Allowed origin (local network): ${origin}`);
    //       return callback(null, origin);
    //     }
        
    //     // Reject other origins
    //     logger.warn(`❌ CORS: Blocked origin: ${origin}`);
    //     callback(new Error('Not allowed by CORS'));
    //   },
    //   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    //   allowedHeaders: [
    //     'Content-Type',
    //     'Authorization',
    //     'X-Requested-With',
    //     'Accept',
    //     'Origin',
    //     'X-Tenant-Id',
    //     'X-Tenant-Domain',
    //     'x-tenant-id',
    //     'x-tenant-domain',
    //     'X-Session-ID',
    //     'x-session-id',
    //     'X-Admin-API-Key',
    //     'x-admin-api-key',
    //     'X-API-Key',
    //     'X-ApiKey',
    //     'x-api-key',
    //     'x-apikey'
    //   ],
    //   exposedHeaders: [
    //     'Content-Type',
    //     'Authorization'
    //   ],
    //   credentials: true,
    //   preflightContinue: false,
    //   optionsSuccessStatus: 204,
    // });
    // Use Express CORS directly to set headers properly
    // app.use(cors({
    //   origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    //     // Always allow the origin if present, or allow all if no origin
    //     callback(null, origin || true);
    //   },
    //   credentials: true,
    //   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    //   allowedHeaders: [
    //     'Content-Type',
    //     'Authorization',
    //     'X-Requested-With',
    //     'Accept',
    //     'Origin',
    //     'X-Tenant-Id',
    //     'X-Tenant-Domain',
    //     'x-tenant-id',
    //     'x-tenant-domain',
    //     'X-Session-ID',
    //     'x-session-id',
    //     'X-Admin-API-Key',
    //     'x-admin-api-key',
    //     'X-API-Key',
    //     'X-ApiKey',
    //     'x-api-key',
    //     'x-apikey'
    //   ],
    //   exposedHeaders: [
    //     'Content-Type',
    //     'Authorization'
    //   ],
    //   preflightContinue: false,
    //   optionsSuccessStatus: 204,
    // }));

    // CRITICAL: Handle OPTIONS preflight requests FIRST before CORS middleware
    // This ensures preflight requests get proper CORS headers
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'OPTIONS') {
        // Set CORS headers for preflight
        const origin = req.headers.origin;
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
        res.setHeader('Access-Control-Allow-Headers', [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'X-Tenant-Id',
          'X-Tenant-Domain',
          'x-tenant-id',
          'x-tenant-domain',
          'X-Subdomain',
          'x-subdomain',
          'X-Session-ID',
          'x-session-id',
          'X-Admin-API-Key',
          'x-admin-api-key',
          'X-API-Key',
          'X-ApiKey',
          'x-api-key',
          'x-apikey'
        ].join(', '));
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        return res.status(204).end(); // Respond to preflight immediately
      }
      next();
    });

    // CRITICAL: Enable CORS FIRST before any other middleware
    // Use Express CORS directly to set headers properly
    app.use(cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
        // Always allow the origin if present, or allow all if no origin
        callback(null, origin || true);
      },
      credentials: true,
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
        'X-Subdomain',
        'x-subdomain',
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
        'Authorization'
      ],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    }));

    // CRITICAL: Remove duplicate CORS headers before response is sent
    // This prevents duplicates from proxy/nginx/vercel
    app.use((req: Request, res: Response, next: NextFunction) => {
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any, cb?: any) {
        // Remove duplicate Access-Control-Allow-Origin headers
        const headers = res.getHeaders();
        const originHeader = headers['access-control-allow-origin'] || headers['Access-Control-Allow-Origin'];
        if (originHeader && Array.isArray(originHeader)) {
          // Multiple values found, keep only the first one
          res.removeHeader('Access-Control-Allow-Origin');
          res.removeHeader('access-control-allow-origin');
          res.setHeader('Access-Control-Allow-Origin', originHeader[0]);
        } else if (originHeader && typeof originHeader === 'string' && originHeader.includes(',')) {
          // Single string with comma-separated values, keep only first
          const firstValue = originHeader.split(',')[0].trim();
          res.removeHeader('Access-Control-Allow-Origin');
          res.removeHeader('access-control-allow-origin');
          res.setHeader('Access-Control-Allow-Origin', firstValue);
        }
        return originalEnd(chunk, encoding, cb);
      };
      next();
    });
    
    // Enable cookie parser AFTER CORS
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

    // Security Hardening (AFTER CORS)
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