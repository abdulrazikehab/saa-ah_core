import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantSyncService } from './tenant-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';
import { TemplateService } from '../template/template.service';
import { PageService } from '../page/page.service';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantSyncService: TenantSyncService,
    private readonly templateService: TemplateService,
    private readonly pageService: PageService,
  ) {}

  @Post('setup')
  async setupMarket(
    @Request() req: AuthenticatedRequest,
    @Body() body: { 
      name: string; 
      description?: string; 
      subdomain: string; 
      customDomain?: string;
      template?: string;
    }
  ) {
    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(body.subdomain)) {
      throw new BadRequestException('Subdomain must contain only lowercase letters, numbers, and hyphens');
    }

    // Check if subdomain is already taken
    const isAvailable = await this.tenantService.checkSubdomainAvailability(body.subdomain);
    if (!isAvailable) {
        // Check if it belongs to the current user (re-setup case)
        const existingTenant = await this.tenantService.getTenant(req.user.id).catch(() => null);
        if (!existingTenant || existingTenant.subdomain !== body.subdomain) {
             throw new ConflictException('Subdomain is already taken');
        }
    }

    // Create tenant using user's ID as tenant ID
    const tenantId = req.user.id;
    
    await this.tenantSyncService.ensureTenantExists(tenantId, {
      name: body.name,
      subdomain: body.subdomain,
      description: body.description,
      templateId: body.template,
    });

    // If template is selected, initialize the Home page
    if (body.template) {
        try {
            // Find the template (assuming body.template is the template ID or we map it)
            // The frontend sends 'modern', 'minimal', etc. which are IDs in the seed data.
            const template = await this.templateService.findOne(body.template);
            
            // Create Home Page
            await this.pageService.create(tenantId, {
                title: 'Home',
                slug: 'home',
                content: template.content,
                isPublished: true,
                seoTitle: body.name,
                seoDesc: body.description,
            }).catch(async (err) => {
                // If page exists, update it
                if (err instanceof ConflictException) {
                    const existingPage = await this.pageService.findBySlug(tenantId, 'home');
                    await this.pageService.update(tenantId, existingPage.id, {
                        content: template.content,
                        isPublished: true,
                    });
                }
            });
        } catch (error) {
            console.error('Failed to apply template:', error);
            // Don't fail the whole setup if template fails, just log it
        }
    }
    
    return {
      id: tenantId,
      name: body.name,
      subdomain: body.subdomain,
      customDomain: body.customDomain,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
  }

  @Get('me')
  async getCurrentUserTenant(@Request() req: AuthenticatedRequest) {
    // Return null if user doesn't have a tenant yet
    if (!req.user?.id) {
      return null;
    }
    
    let tenantId = req.user.tenantId;
    if (!tenantId) {
       tenantId = await this.tenantService.getTenantIdByUserId(req.user.id);
    }

    if (!tenantId) {
        return null;
    }

    try {
      const tenant = await this.tenantService.getTenant(tenantId);
      return tenant;
    } catch (error) {
      // Return null if tenant not found (user hasn't set up their tenant yet)
      return null;
    }
  }

  @Post('update-me')
  async updateCurrentUserTenant(
    @Request() req: AuthenticatedRequest,
    @Body() body: { name?: string; subdomain?: string }
  ) {
    if (!req.user?.id) {
      throw new BadRequestException('User not authenticated');
    }

    let tenantId = req.user.tenantId;
    
    // Fallback: fetch from DB if missing in token
    if (!tenantId) {
       tenantId = await this.tenantService.getTenantIdByUserId(req.user.id);
    }

    if (!tenantId) {
        throw new NotFoundException('Tenant not found for user');
    }

    // If subdomain is being updated, check availability
    if (body.subdomain) {
      // Validate format
      if (!/^[a-z0-9-]+$/.test(body.subdomain)) {
        throw new BadRequestException('Subdomain must contain only lowercase letters, numbers, and hyphens');
      }

      const isAvailable = await this.tenantService.checkSubdomainAvailability(body.subdomain);
      if (!isAvailable) {
        // Check if it's the same tenant
        const existingTenant = await this.tenantService.getTenant(tenantId);
        if (existingTenant.subdomain !== body.subdomain) {
          throw new ConflictException('Subdomain is already taken');
        }
      }
    }

    const updatedTenant = await this.tenantService.updateTenant(tenantId, body);

    // Ensure Home page exists (Self-healing for existing tenants)
    try {
        await this.pageService.findBySlug(tenantId, 'home');
    } catch (e) {
        // Create it if missing
        try {
            await this.pageService.create(tenantId, {
              title: 'Home',
              slug: 'home',
              content: JSON.stringify([
                {
                  id: 'hero',
                  type: 'hero',
                  content: {
                    title: `Welcome to ${updatedTenant.name}`,
                    subtitle: 'Discover our amazing products',
                    buttonText: 'Shop Now',
                    buttonLink: '/products'
                  }
                }
              ]),
              isPublished: true,
              seoTitle: updatedTenant.name,
              seoDesc: `Welcome to ${updatedTenant.name}`,
            });
        } catch (createError) {
             console.error('Failed to auto-create home page:', createError);
        }
    }

    return updatedTenant;
  }

  @Post('sync')
  async syncTenant(@Body() body: { tenantId: string; name?: string; subdomain?: string }) {
    await this.tenantSyncService.ensureTenantExists(body.tenantId, {
      name: body.name,
      subdomain: body.subdomain,
    });
    return { message: 'Tenant synchronized successfully' };
  }

  @Get(':id')
  async getTenant(@Param('id') id: string) {
    return this.tenantService.getTenant(id);
  }

  // Add this endpoint to manually create tenants for testing
  @Post('create-test')
  async createTestTenant(@Body() body: { id: string; name: string; subdomain: string }) {
    try {
      await this.tenantSyncService.ensureTenantExists(body.id, {
        name: body.name,
        subdomain: body.subdomain,
      });
      return { message: 'Test tenant created successfully' };
    } catch (error) {
      return { error: error };
    }
  }
}