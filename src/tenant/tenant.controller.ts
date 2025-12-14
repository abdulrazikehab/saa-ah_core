import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantSyncService } from './tenant-sync.service';
import { AuthClientService } from './auth-client.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';
import { TemplateService } from '../template/template.service';
import { PageService } from '../page/page.service';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantSyncService: TenantSyncService,
    private readonly authClientService: AuthClientService,
    private readonly templateService: TemplateService,
    private readonly pageService: PageService,
    private readonly prisma: PrismaService,
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
      throw new ConflictException('Subdomain is already taken');
    }

    // Check market limit
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const limitCheck = await this.authClientService.checkCanCreateMarket(req.user.id, accessToken);
    
    if (!limitCheck.allowed) {
      throw new ForbiddenException(
        `Market limit reached. You have ${limitCheck.currentCount} of ${limitCheck.limit} markets. Please contact support to increase your limit.`
      );
    }

    // Generate new tenant ID
    const tenantId = uuidv4();
    
    // Create tenant in both core and auth databases, and link to user
    try {
      // Create in auth database and link user (this also checks market limit)
      await this.authClientService.createTenantAndLink(
        req.user.id,
        {
          id: tenantId,
          name: body.name,
          subdomain: body.subdomain,
          plan: 'STARTER',
          status: 'ACTIVE',
        },
        accessToken
      );

      // Create tenant in core database
      await this.tenantSyncService.ensureTenantExists(tenantId, {
        name: body.name,
        subdomain: body.subdomain,
        description: body.description,
        templateId: body.template,
      });
    } catch (error: any) {
      // If creation fails, try to clean up
      await this.prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
      if (error.message?.includes('Market limit reached')) {
        throw new ForbiddenException(error.message);
      }
      throw new BadRequestException(error.message || 'Failed to create market. Please try again.');
    }

    // Initialize default SiteConfig for the new market
    try {
      await this.prisma.siteConfig.create({
        data: {
          tenantId,
          header: {
            logo: null,
            storeName: body.name,
            menuItems: [
              { label: 'Home', href: '/' },
              { label: 'Products', href: '/products' },
              { label: 'About', href: '/about' },
              { label: 'Contact', href: '/contact' },
            ],
          },
          footer: {
            copyright: `© ${new Date().getFullYear()} ${body.name}. All rights reserved.`,
            socialLinks: [],
            links: [],
          },
          background: {
            type: 'solid',
            color: '#ffffff',
          },
          language: 'en',
          theme: 'light',
          paymentMethods: [],
          hyperpayConfig: {},
        },
      });
    } catch (error) {
      console.error('Failed to create site config:', error);
      // Non-fatal: continue even if site config creation fails
    }

    // Store market data in tenant settings
    try {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          settings: {
            storeName: body.name,
            storeDescription: body.description,
            templateId: body.template,
            customDomain: body.customDomain,
            createdAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to update tenant settings:', error);
    }

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
    } else {
      // Create default Home page if no template selected
      try {
        await this.pageService.create(tenantId, {
          title: 'Home',
          slug: 'home',
          content: [
            {
              id: 'hero',
              type: 'hero',
              content: {
                title: `Welcome to ${body.name}`,
                subtitle: body.description || 'Discover our amazing products',
                buttonText: 'Shop Now',
                buttonLink: '/products',
              },
            },
          ],
          isPublished: true,
          seoTitle: body.name,
          seoDesc: body.description || `Welcome to ${body.name}`,
        });
      } catch (error) {
        console.error('Failed to create default home page:', error);
      }
    }

    // Create default About and Contact pages
    try {
      await this.pageService.create(tenantId, {
        title: 'About Us',
        slug: 'about',
        content: [
          {
            id: 'about-content',
            type: 'text',
            content: {
              title: `About ${body.name}`,
              text: body.description || `Welcome to ${body.name}. We are dedicated to providing the best products and services to our customers.`,
            },
          },
        ],
        isPublished: true,
        seoTitle: `About - ${body.name}`,
        seoDesc: `Learn more about ${body.name}`,
      });
    } catch (error) {
      // Ignore if page already exists
    }

    try {
      await this.pageService.create(tenantId, {
        title: 'Contact',
        slug: 'contact',
        content: [
          {
            id: 'contact-content',
            type: 'contact',
            content: {
              title: 'Contact Us',
              subtitle: 'Get in touch with us',
            },
          },
        ],
        isPublished: true,
        seoTitle: `Contact - ${body.name}`,
        seoDesc: `Contact ${body.name}`,
      });
    } catch (error) {
      // Ignore if page already exists
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