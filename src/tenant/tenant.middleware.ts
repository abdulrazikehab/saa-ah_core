import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { DomainService } from '../domain/domain.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private jwtService: JwtService,
    private domainService: DomainService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;
    let detectedFrom = 'unknown';

    // Method 1: Extract from JWT token (API requests)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payload = this.jwtService.verify(token);
        if (payload.tenantId) {
          tenantId = payload.tenantId;
          detectedFrom = 'jwt';
        }
      } catch (error) {
        // Token verification failed, continue to other methods
      }
    }

    // Method 2: Extract from X-Tenant-Domain header (Frontend explicit)
    if (!tenantId) {
      const tenantDomainHeader = req.headers['x-tenant-domain'] as string;
      if (tenantDomainHeader) {
        // Use the logic to resolve from domain string
        tenantId = await this.resolveTenantFromDomain(tenantDomainHeader);
        if (tenantId) {
          detectedFrom = `header:${tenantDomainHeader}`;
        }
      }
    }

    // Method 3: Extract from hostname (Direct API calls or fallback)
    if (!tenantId) {
      const hostname = req.headers.host;
      if (hostname) {
        // Remove port if present
        const cleanHostname = hostname.split(':')[0];
        tenantId = await this.resolveTenantFromDomain(cleanHostname);
        if (tenantId) {
          detectedFrom = `host:${cleanHostname}`;
        }
      }
    }

    // Attach tenant context to request
    if (tenantId) {
      (req as any).tenantId = tenantId;
      (req as any).tenantDetectedFrom = detectedFrom;
    }

    next();
  }

  private async resolveTenantFromDomain(hostname: string): Promise<string | undefined> {
    // Check if it's a custom domain
    const domainInfo = await this.domainService.getDomainByHostname(hostname);
    if (domainInfo) {
      return domainInfo.tenantId;
    }

    // Check if it's a subdomain
    const subdomain = this.extractSubdomain(hostname);
    if (subdomain) {
      // Look up the tenant by subdomain
      const tenantId = await this.domainService.findTenantBySubdomain(subdomain);
      return tenantId || undefined;
    }

    return undefined;
  }

  private extractSubdomain(hostname: string): string | null {
    // Handle localhost
    if (hostname.endsWith('.localhost')) {
      return hostname.replace('.localhost', '');
    }
    
    // Handle production domains
    const platformDomains = ["saa'ah.com", "app.saa'ah.com"]; 
    
    for (const domain of platformDomains) {
      if (hostname.endsWith(domain)) {
        const subdomain = hostname.replace(`.${domain}`, '');
        if (subdomain !== hostname && subdomain !== 'www') {
          return subdomain;
        }
      }
    }
    
    return null;
  }
}