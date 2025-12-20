import { Controller, Get, Post, Body, Param, UseGuards, Request, BadRequestException, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantSyncService } from './tenant-sync.service';
import { AuthClientService } from './auth-client.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';
import { TemplateService } from '../template/template.service';
import { PageService } from '../page/page.service';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantService } from '../merchant/services/merchant.service';
import { UserService } from '../user/user.service';
import { v4 as uuidv4 } from 'uuid';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
  private readonly logger = new Logger(TenantController.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantSyncService: TenantSyncService,
    private readonly authClientService: AuthClientService,
    private readonly templateService: TemplateService,
    private readonly pageService: PageService,
    private readonly prisma: PrismaService,
    private readonly merchantService: MerchantService,
    private readonly userService: UserService,
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
    try {
      // Validate request body
      if (!body) {
        throw new BadRequestException('Request body is required');
      }
      if (!body.name || !body.name.trim()) {
        throw new BadRequestException('Market name is required');
      }
      if (!body.subdomain || !body.subdomain.trim()) {
        throw new BadRequestException('Subdomain is required');
      }
      if (!req.user || !req.user.id) {
        throw new BadRequestException('User authentication required');
      }

      // Validate subdomain format
      if (!/^[a-z0-9-]+$/.test(body.subdomain)) {
        throw new BadRequestException('Subdomain must contain only lowercase letters, numbers, and hyphens');
      }

    // Check if subdomain is already taken or conflicts with custom domain
    const isAvailable = await this.tenantService.checkSubdomainAvailability(body.subdomain);
    if (!isAvailable) {
      throw new ConflictException(
        `Subdomain "${body.subdomain}" is already taken or conflicts with an existing custom domain. ` +
        `Please choose a different subdomain.`
      );
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
    this.logger.log(`🔄 Starting tenant setup for ID: ${tenantId}, subdomain: ${body.subdomain}`);
    
    // Create tenant in both core and auth databases, and link to user
    try {
      // Create in auth database and link user (this also checks market limit)
      this.logger.log(`📤 Creating tenant in auth database...`);
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
      this.logger.log(`✅ Tenant created in auth database`);

      // Create tenant in core database
      this.logger.log(`📤 Creating tenant in core database...`);
      const createdTenant = await this.tenantSyncService.ensureTenantExists(tenantId, {
        name: body.name,
        subdomain: body.subdomain,
        description: body.description,
        templateId: body.template,
      });

      if (!createdTenant) {
        this.logger.error(`❌ ensureTenantExists returned null for tenant ${tenantId}`);
        throw new BadRequestException('Failed to create tenant in core database');
      }
      this.logger.log(`✅ Tenant created successfully: ${createdTenant.id}`);

      // Verify tenant exists in database (double-check after creation)
      // Use a more robust verification with multiple retries
      let verifiedTenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      
      // If we got the tenant from ensureTenantExists, use it directly
      if (!verifiedTenant && createdTenant) {
        this.logger.log(`⚠️ Tenant not immediately visible, using created tenant data...`);
        verifiedTenant = createdTenant as any; // Type assertion for compatibility
      }

      if (!verifiedTenant) {
        // Retry check with exponential backoff (handles potential transaction timing)
        const maxRetries = 10; // Increased retries
        const baseDelay = 50; // Start with 50ms delay
        
        for (let i = 0; i < maxRetries; i++) {
          const delay = Math.min(baseDelay * Math.pow(2, i), 500); // Exponential backoff, capped at 500ms
          this.logger.log(`⏳ Tenant ${tenantId} not found yet, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          verifiedTenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
          });
          
          if (verifiedTenant) {
            this.logger.log(`✅ Tenant ${tenantId} found after ${i + 1} attempt(s)`);
            break;
          }
        }
        
        if (!verifiedTenant) {
          this.logger.error(`❌ Tenant ${tenantId} was not found after creation. Checking database...`);
          // Final check - maybe there's a database connection issue
          // Final diagnostic check
          const allTenants = await this.prisma.tenant.findMany({ take: 5 });
          this.logger.log(`Database connection OK. Found ${allTenants.length} tenant(s) in database.`);
          
          // Check if tenant exists with different query
          const tenantBySubdomain = await this.prisma.tenant.findFirst({
            where: { subdomain: body.subdomain },
          });
          
          if (tenantBySubdomain && tenantBySubdomain.id !== tenantId) {
            this.logger.error(`⚠️ Found tenant with same subdomain but different ID: ${tenantBySubdomain.id}`);
            throw new ConflictException('Subdomain is already taken by another tenant');
          }
          
          if (allTenants.length === 0) {
            this.logger.error(`❌ Database connection issue: No tenants found in database`);
            throw new BadRequestException('Database connection issue. Please try again.');
          }
          
          throw new BadRequestException(`Tenant ${tenantId} was not found after creation. Please try again.`);
        }
      }

      // Ensure user exists in core database (sync from auth)
      // Pass tenantId only after tenant is confirmed to exist
      await this.userService.ensureUserExists(req.user.id, {
        email: req.user.email || '',
        name: req.user.name,
        role: req.user.role || 'SHOP_OWNER',
        tenantId: tenantId, // Now safe to pass since tenant exists
      });

      // Create merchant for this user and tenant (with user data for auto-sync if needed)
      await this.merchantService.getOrCreateMerchant(tenantId, req.user.id, {
        businessName: body.name,
        email: req.user.email || '',
        name: req.user.name,
        role: req.user.role || 'SHOP_OWNER',
      });
    } catch (error: any) {
      this.logger.error(`❌ Error during tenant setup for ${tenantId}:`, error);
      
      // If creation fails, try to clean up (ignore errors if tenant doesn't exist)
      try {
        const tenantExists = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenantExists) {
          this.logger.warn(`Attempting to delete partially created tenant ${tenantId} due to error.`);
          await this.prisma.tenant.delete({ where: { id: tenantId } });
          this.logger.log(`Cleaned up tenant ${tenantId}.`);
        } else {
          this.logger.warn(`Tenant ${tenantId} did not exist in core database, no cleanup needed.`);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
        this.logger.warn(`Cleanup failed for tenant ${tenantId}: ${cleanupError}`);
      }
      
      // Handle specific error types
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Check error message for specific cases
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      if (errorMessage.includes('Market limit reached')) {
        throw new ForbiddenException(errorMessage);
      }
      
      // Log full error details for debugging
      this.logger.error(`Full error details:`, {
        message: errorMessage,
        stack: error?.stack,
        name: error?.name,
      });
      
      throw new BadRequestException(errorMessage || 'Failed to create market. Please try again.');
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
    } catch (error: any) {
      // This catch block handles errors from the entire method
      this.logger.error(`❌ Error in setupMarket method:`, error);
      
      // Re-throw known exceptions
      if (error instanceof BadRequestException || 
          error instanceof ConflictException || 
          error instanceof ForbiddenException) {
        throw error;
      }
      
      // For unknown errors, wrap in BadRequestException
      const errorMessage = error?.message || error?.toString() || 'Failed to create market. Please try again.';
      throw new BadRequestException(errorMessage);
    }
  }

  @Get('me')
  async getCurrentUserTenant(@Request() req: AuthenticatedRequest) {
    // Return null if user doesn't have a tenant yet
    if (!req.user?.id) {
      return null;
    }
    
    let tenantId: string | null = req.user.tenantId || null;
    if (!tenantId) {
       const fetchedTenantId = await this.tenantService.getTenantIdByUserId(req.user.id);
       if (!fetchedTenantId) {
         throw new Error('Tenant ID not found');
       }
       tenantId = fetchedTenantId;
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

    let tenantId: string | null = req.user.tenantId || null;
    
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

      const isAvailable = await this.tenantService.checkSubdomainAvailability(body.subdomain, tenantId);
      if (!isAvailable) {
        // Check if it's the same tenant (double-check, though checkSubdomainAvailability should handle this)
        const existingTenant = await this.tenantService.getTenant(tenantId);
        if (existingTenant.subdomain !== body.subdomain) {
          throw new ConflictException(
            `Subdomain "${body.subdomain}" is already taken or conflicts with an existing custom domain. ` +
            `Please choose a different subdomain.`
          );
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