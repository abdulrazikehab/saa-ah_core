import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const subscriptionPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: tenant.plan },
    });

    return { ...tenant, subscriptionPlan };
  }

  async getAllTenants() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateTenant(id: string, data: { name?: string; subdomain?: string; plan?: string; status?: string }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });
    return !tenant;
  }

  async resolveTenantId(domain: string): Promise<string | null> {
    // Normalize domain (remove protocol, port, trailing slashes)
    const normalizedDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0];
    
    // 1. First check if it's a custom domain (including saeaa.com as main domain)
    const customDomain = await this.prisma.customDomain.findFirst({
      where: { 
        domain: normalizedDomain,
        status: 'ACTIVE'
      },
      select: { tenantId: true },
    });

    if (customDomain) return customDomain.tenantId;

    // 2. Check if it's the main domain (saeaa.com or saeaa.net) - should be handled as custom domain, but fallback
    const mainDomains = [
      'saeaa.com',
      'www.saeaa.com',
      'saeaa.net',
      'www.saeaa.net',
      'app.saeaa.com',
      'app.saeaa.net'
    ];
    if (mainDomains.includes(normalizedDomain)) {
      // Try to find default tenant or first tenant
      const defaultTenant = await this.prisma.tenant.findFirst({
        where: { id: 'default' },
        select: { id: true },
      });
      if (defaultTenant) return defaultTenant.id;
    }

    // 3. Check if it's a subdomain of localhost or the main domain
    let subdomain = '';
    
    if (normalizedDomain.endsWith('.localhost')) {
      subdomain = normalizedDomain.replace('.localhost', '');
    } else if (normalizedDomain.endsWith('.saeaa.com')) {
      subdomain = normalizedDomain.replace('.saeaa.com', '');
      // Don't treat www or app as a subdomain
      if (subdomain === 'www' || subdomain === 'app') {
        return null;
      }
    } else if (normalizedDomain.endsWith('.saeaa.net')) {
      subdomain = normalizedDomain.replace('.saeaa.net', '');
      // Don't treat www or app as a subdomain
      if (subdomain === 'www' || subdomain === 'app') {
        return null;
      }
    } else if (normalizedDomain === 'localhost' || normalizedDomain === '127.0.0.1') {
      return null; // Main domain, no tenant
    }

    if (subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
        select: { id: true },
      });
      if (tenant) return tenant.id;
    }

    return null;
  }

  async getTenantIdByUserId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });
    return user?.tenantId || null;
  }
}