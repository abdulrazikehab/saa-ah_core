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
    // 1. Check if it's a subdomain of localhost or the main domain
    // We assume the domain passed here is the full hostname (e.g. "store.localhost" or "store.saa'ah.com")
    
    let subdomain = '';
    
    if (domain.endsWith('.localhost')) {
      subdomain = domain.replace('.localhost', '');
    } else if (domain.endsWith(".saa'ah.com")) { // Replace with your actual production domain
      subdomain = domain.replace(".saa'ah.com", '');
    } else if (domain === 'localhost' || domain === '127.0.0.1') {
      return null; // Main domain, no tenant
    }

    if (subdomain) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
        select: { id: true },
      });
      if (tenant) return tenant.id;
    }

    // 2. Check if it's a custom domain
    const customDomain = await this.prisma.customDomain.findUnique({
      where: { domain },
      select: { tenantId: true },
    });

    if (customDomain) return customDomain.tenantId;

    if (customDomain) return customDomain.tenantId;

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