import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantSyncService {
  private readonly logger = new Logger(TenantSyncService.name);

  constructor(private prisma: PrismaService) {}

  async ensureTenantExists(tenantId: string, tenantData?: { name?: string; subdomain?: string; description?: string; templateId?: string }): Promise<{ id: string; name: string; subdomain: string } | null> {
    try {
      this.logger.log(`🔍 Checking if tenant exists: ${tenantId}`);

      // Check if tenant already exists in core database
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (existingTenant) {
        this.logger.log(`✅ Tenant already exists: ${tenantId}`);
        // Update existing tenant with new data if provided (including subdomain and name)
        const updateData: any = {};
        if (tenantData?.name) updateData.name = tenantData.name;
        if (tenantData?.subdomain) updateData.subdomain = tenantData.subdomain;
        if (tenantData?.description) updateData.description = tenantData.description;
        if (tenantData?.templateId) updateData.templateId = tenantData.templateId;
        
        if (Object.keys(updateData).length > 0) {
          this.logger.log(`🔄 Updating tenant ${tenantId} with new data:`, updateData);
          const updated = await this.prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
          });
          return { id: updated.id, name: updated.name, subdomain: updated.subdomain };
        }
        return { id: existingTenant.id, name: existingTenant.name, subdomain: existingTenant.subdomain };
      }

      // Only create tenant if subdomain is provided - don't create with random subdomain
      if (!tenantData?.subdomain) {
        this.logger.warn(`⚠️ Cannot create tenant ${tenantId} without subdomain. Skipping creation.`);
        return null;
      }

      this.logger.log(`🔄 Creating new tenant: ${tenantId}`);
      
      // Create tenant in core database
      const created = await this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: tenantData?.name || `Tenant-${tenantId.substring(0, 8)}`,
          subdomain: tenantData.subdomain,
          description: tenantData?.description,
          templateId: tenantData?.templateId,
          plan: 'STARTER',
          status: 'ACTIVE',
        },
      });
      
      this.logger.log(`✅ Tenant created successfully: ${tenantId}`);
      return { id: created.id, name: created.name, subdomain: created.subdomain };
    } catch (error: any) {
      this.logger.error(`❌ Failed to ensure tenant exists: ${tenantId}`, error);
      
      // If it's a unique constraint error, verify the tenant actually exists
      if (error?.code === 'P2002') {
        this.logger.log(`⚠️ Unique constraint violation for tenant ${tenantId}, verifying existence...`);
        // Verify the tenant actually exists before returning true
        const existingTenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        if (existingTenant) {
          this.logger.log(`✅ Tenant ${tenantId} exists (created by another request)`);
          return { id: existingTenant.id, name: existingTenant.name, subdomain: existingTenant.subdomain };
        } else {
          // Tenant doesn't exist but we got a constraint error - this is unexpected
          this.logger.error(`❌ P2002 error but tenant ${tenantId} does not exist. Constraint violation:`, error.meta);
          throw error;
        }
      }
      
      throw error;
    }
  }

  async syncTenantFromAuth(tenantId: string, tenantData: { name: string; subdomain: string }): Promise<void> {
    await this.ensureTenantExists(tenantId, tenantData);
  }
}