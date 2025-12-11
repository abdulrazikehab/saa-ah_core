import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantSyncService {
  private readonly logger = new Logger(TenantSyncService.name);

  constructor(private prisma: PrismaService) {}

  async ensureTenantExists(tenantId: string, tenantData?: { name?: string; subdomain?: string; description?: string; templateId?: string }): Promise<boolean> {
    try {
      this.logger.log(`🔍 Checking if tenant exists: ${tenantId}`);

      // Check if tenant already exists in core database
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (existingTenant) {
        this.logger.log(`✅ Tenant already exists: ${tenantId}`);
        // Update existing tenant with new data if provided
        if (tenantData?.description || tenantData?.templateId) {
             await this.prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    description: tenantData.description,
                    templateId: tenantData.templateId,
                }
             });
        }
        return true;
      }

      this.logger.log(`🔄 Creating new tenant: ${tenantId}`);
      
      // Create tenant in core database
      await this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: tenantData?.name || `Tenant-${tenantId.substring(0, 8)}`,
          subdomain: tenantData?.subdomain || `tenant-${tenantId.substring(0, 8)}`,
          description: tenantData?.description,
          templateId: tenantData?.templateId,
          plan: 'STARTER',
          status: 'ACTIVE',
        },
      });
      
      this.logger.log(`✅ Tenant created successfully: ${tenantId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`❌ Failed to ensure tenant exists: ${tenantId}`, error);
      
      // If it's a unique constraint error, the tenant might have been created by another request
      if (error?.code === 'P2002') {
        this.logger.log(`⚠️ Tenant ${tenantId} was created by another request`);
        return true;
      }
      
      throw error;
    }
  }

  async syncTenantFromAuth(tenantId: string, tenantData: { name: string; subdomain: string }): Promise<void> {
    await this.ensureTenantExists(tenantId, tenantData);
  }
}