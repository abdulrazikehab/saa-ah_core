import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);

  constructor(private prisma: PrismaService) {}

  async addCustomDomain(tenantId: string, domain: string) {
    // Normalize domain
    const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

    // Validate domain format
    if (!this.isValidDomain(normalizedDomain)) {
      throw new BadRequestException('Invalid domain format');
    }

    // Check if domain already exists
    const existingDomain = await this.prisma.customDomain.findUnique({
      where: { domain: normalizedDomain },
    });

    if (existingDomain) {
      throw new ConflictException('Domain already registered');
    }

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Create domain record
    const customDomain = await this.prisma.customDomain.create({
      data: {
        domain: normalizedDomain,
        tenantId,
        status: 'PENDING',
        sslStatus: 'PENDING',
      },
    });

    this.logger.log(`Domain ${normalizedDomain} added for tenant ${tenantId}`);

    // Return DNS verification instructions
    return {
      domain: customDomain,
      verification: {
        type: 'DNS',
        instructions: `Please add a TXT record to your DNS:`,
        record: `saa'ah-verify=${tenantId}`,
        expectedValue: tenantId,
      },
    };
  }

  async verifyDomain(tenantId: string, domainId: string) {
    const customDomain = await this.prisma.customDomain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!customDomain) {
      throw new NotFoundException('Domain not found');
    }

    // Verify DNS records
    const expectedRecord = `saa'ah-verify=${tenantId}`;
    const isVerified = await this.checkDnsRecord(customDomain.domain, expectedRecord);

    if (!isVerified) {
        throw new BadRequestException('DNS verification failed. Please ensure the TXT record is added correctly.');
    }
    
    const verifiedDomain = await this.prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: 'ACTIVE',
        verifiedAt: new Date(),
        sslStatus: 'PENDING', // SSL provisioning will happen separately
      },
    });

    // Initiate SSL certificate provisioning
    await this.provisionSSLCertificate(domainId);

    this.logger.log(`Domain ${customDomain.domain} verified for tenant ${tenantId}`);

    return {
      domain: verifiedDomain,
      message: 'Domain verified successfully. SSL certificate provisioning initiated.',
    };
  }

  private async checkDnsRecord(domain: string, expectedValue: string): Promise<boolean> {
    try {
        const { resolveTxt } = await import('dns/promises');
        const records = await resolveTxt(domain);
        // Flatten records as they come as arrays of strings
        const flatRecords = records.flat();
        return flatRecords.includes(expectedValue);
    } catch (error) {
        this.logger.warn(`DNS lookup failed for ${domain}: ${error}`);
        return false;
    }
  }

  async provisionSSLCertificate(domainId: string) {
    const domain = await this.prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    // In production, integrate with Let's Encrypt or Cloudflare
    // For now, simulate SSL provisioning
    try {
      // Simulate SSL certificate generation
      const sslCertificate = await this.prisma.sslCertificate.create({
        data: {
          domainId,
          issuer: 'Let\'s Encrypt',
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          autoRenew: true,
        },
      });

      // Update domain SSL status
      await this.prisma.customDomain.update({
        where: { id: domainId },
        data: {
          sslStatus: 'ACTIVE',
        },
      });

      this.logger.log(`SSL certificate provisioned for domain: ${domain.domain}`);
      
      return sslCertificate;
    } catch (error) {
      this.logger.error(`SSL provisioning failed for domain ${domain.domain}:`, error);
      
      await this.prisma.customDomain.update({
        where: { id: domainId },
        data: {
          sslStatus: 'FAILED',
        },
      });

      throw new BadRequestException('SSL certificate provisioning failed');
    }
  }

  async getTenantDomains(tenantId: string) {
    return this.prisma.customDomain.findMany({
      where: { tenantId },
      include: {
        sslCertificates: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get the latest SSL certificate
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeDomain(tenantId: string, domainId: string) {
    const domain = await this.prisma.customDomain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    // Delete SSL certificates first (due to foreign key constraint)
    await this.prisma.sslCertificate.deleteMany({
      where: { domainId },
    });

    await this.prisma.customDomain.delete({
      where: { id: domainId },
    });

    this.logger.log(`Domain ${domain.domain} removed for tenant ${tenantId}`);

    return { message: 'Domain removed successfully' };
  }

  async getDomainByHostname(hostname: string) {
    const normalizedHostname = hostname.toLowerCase();
    
    return this.prisma.customDomain.findFirst({
      where: {
        domain: normalizedHostname,
        status: 'ACTIVE',
      },
      include: {
        tenant: true,
        sslCertificates: {
          where: {
            expiresAt: { gt: new Date() }, // Only valid certificates
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  // Add this method for subdomain lookup
  async findTenantBySubdomain(subdomain: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true },
    });
    
    return tenant?.id || null;
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }

  async getSSLCertificates(domainId: string) {
    return this.prisma.sslCertificate.findMany({
      where: { domainId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async renewSSLCertificate(domainId: string) {
    const domain = await this.prisma.customDomain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    if (domain.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot renew SSL for inactive domain');
    }

    // Mark old certificates as expired
    await this.prisma.sslCertificate.updateMany({
      where: { domainId },
      data: { expiresAt: new Date() },
    });

    // Provision new certificate
    return this.provisionSSLCertificate(domainId);
  }
}