import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSyncService } from '../tenant/tenant-sync.service';
import { DEFAULT_THEMES } from './default-themes.config';

@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);

  constructor(
    private prisma: PrismaService,
    private tenantSyncService: TenantSyncService,
  ) {}

  async create(tenantId: string, data: any) {
    await this.tenantSyncService.ensureTenantExists(tenantId);
    return this.prisma.theme.create({
      data: {
        ...data,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    console.log('🔍 ThemeService.findAll - Querying for tenantId:', tenantId);
    const themes = await this.prisma.theme.findMany({
      where: { tenantId },
      include: { versions: true },
    });
    console.log('🔍 ThemeService.findAll - Found', themes.length, 'themes');
    return themes;
  }

  async findOne(tenantId: string, id: string) {
    const theme = await this.prisma.theme.findFirst({
      where: { id, tenantId },
      include: { versions: true },
    });

    if (!theme) {
      throw new NotFoundException(`Theme with ID ${id} not found`);
    }

    return theme;
  }

  async update(tenantId: string, id: string, data: any) {
    await this.findOne(tenantId, id); // Ensure exists

    return this.prisma.theme.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // Ensure exists

    return this.prisma.theme.delete({
      where: { id },
    });
  }

  async install(tenantId: string, themeId: string) {
    // Logic to "install" a theme (e.g., set as active, copy assets)
    // For now, just mark as installed
    return this.update(tenantId, themeId, { isInstalled: true });
  }

  async activate(tenantId: string, themeId: string) {
    // Deactivate all other themes
    await this.prisma.theme.updateMany({
      where: { tenantId, isActive: true },
      data: { isActive: false },
    });

    // Activate this one
    return this.update(tenantId, themeId, { isActive: true });
  }

  /**
   * Create default themes for a new tenant
   * This is called automatically when a tenant is created
   */
  async createDefaultThemes(tenantId: string) {
    try {
      this.logger.log(`Creating default themes for tenant: ${tenantId}`);
      
      // Check if themes already exist for this tenant
      const existingThemes = await this.prisma.theme.count({
        where: { tenantId }
      });

      if (existingThemes > 0) {
        this.logger.log(`Tenant ${tenantId} already has ${existingThemes} themes, skipping default creation`);
        return;
      }

      // Create all default themes
      const createdThemes = await Promise.all(
        DEFAULT_THEMES.map(theme =>
          this.prisma.theme.create({
            data: {
              ...theme,
              tenantId,
              settings: theme.settings as any, // Prisma Json type
            }
          })
        )
      );

      this.logger.log(`✅ Created ${createdThemes.length} default themes for tenant ${tenantId}`);
      return createdThemes;
    } catch (error) {
      this.logger.error(`Failed to create default themes for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Ensure a tenant has default themes
   * Can be called to check and create themes if they don't exist
   */
  async ensureDefaultThemes(tenantId: string) {
    const themes = await this.findAll(tenantId);
    if (themes.length === 0) {
      this.logger.log(`No themes found for tenant ${tenantId}, creating defaults`);
      return this.createDefaultThemes(tenantId);
    }
    return themes;
  }
}
