import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';

@Injectable()
export class PartnerService {
  constructor(private prisma: PrismaService) {}

  async createMarketplace(tenantId: string, dto: CreateMarketplaceDto) {
    console.log('🏪 Creating marketplace for tenant:', tenantId);
    console.log('📦 Marketplace data:', dto);

    // First, get existing tenant settings
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const existingSettings = (existingTenant?.settings as any) || {};

    // Update tenant with marketplace settings and mark ASUS partner as completed
    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name,
        settings: {
          ...existingSettings, // Preserve existing settings
          nameAr: dto.nameAr,
          category: dto.category,
          logo: dto.logo,
          template: dto.template,
          reportFrequency: dto.reportFrequency,
          paymentGateways: dto.paymentGateways,
          asusPartnerCompleted: true, // Mark as completed
        },
      },
    });

    // Link selected products to this tenant (if they're not already)
    // This assumes products are already in the database
    // You might want to create product associations here

    // Create Home Page with selected template
    if (dto.templateContent) {
      console.log('📄 Creating home page with template content');
      
      // Transform AI content to PageBuilder format if needed
      let homePageContent: any = dto.templateContent;
      if (Array.isArray(dto.templateContent)) {
        const sections = dto.templateContent.map((s: any, idx: number) => ({
          id: s.id || `section-${idx}`,
          type: s.type,
          props: { ...s.data, ...s.styles }
        }));
        homePageContent = { sections };
      }

      // Check if home page exists (empty slug = home page)
      const existingHome = await this.prisma.page.findFirst({
        where: { tenantId, slug: '' }
      });

      if (existingHome) {
        await this.prisma.page.update({
          where: { id: existingHome.id },
          data: { content: homePageContent }
        });
      } else {
        await this.prisma.page.create({
          data: {
            tenantId,
            title: 'Home',
            slug: '', // Empty slug for home page
            content: homePageContent,
            isPublished: true,
          }
        });
      }
    }

    // Create standard pages if they don't exist
    const standardPages = [
      {
        title: 'About Us',
        slug: 'about', // No leading slash
        content: {
          sections: [
            {
              id: 'about-hero',
              type: 'hero',
              props: {
                title: 'About Us',
                subtitle: 'Learn more about our story and mission',
                backgroundColor: '#1a1a1a',
                textColor: '#ffffff',
                minHeight: '400px'
              }
            },
            {
              id: 'about-text',
              type: 'text',
              props: {
                content: `Welcome to ${dto.name}. We are dedicated to providing the best products and service to our customers.`
              }
            }
          ]
        }
      },
      {
        title: 'Contact Us',
        slug: 'contact', // No leading slash
        content: {
          sections: [
            {
              id: 'contact-hero',
              type: 'hero',
              props: {
                title: 'Contact Us',
                subtitle: 'Get in touch with our team',
                backgroundColor: '#1a1a1a',
                textColor: '#ffffff',
                minHeight: '300px'
              }
            },
            {
              id: 'contact-form',
              type: 'contact',
              props: {
                title: 'Send us a message',
                email: 'support@example.com',
                phone: '+1234567890'
              }
            }
          ]
        }
      },
      {
        title: 'Products',
        slug: 'products', // No leading slash
        content: {
          sections: [
            {
              id: 'products-hero',
              type: 'hero',
              props: {
                title: 'Our Products',
                subtitle: 'Browse our collection',
                backgroundColor: '#1a1a1a',
                textColor: '#ffffff',
                minHeight: '300px'
              }
            },
            {
              id: 'products-grid',
              type: 'products',
              props: {
                title: 'All Products',
                limit: 12,
                layout: 'grid',
                columns: 4
              }
            }
          ]
        }
      }
    ];

    for (const page of standardPages) {
      const existingPage = await this.prisma.page.findFirst({
        where: { tenantId, slug: page.slug }
      });

      if (!existingPage) {
        await this.prisma.page.create({
          data: {
            tenantId,
            title: page.title,
            slug: page.slug,
            content: page.content,
            isPublished: true
          }
        });
      }
    }

    console.log('✅ Marketplace created successfully');

    return {
      success: true,
      marketplace: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain,
      },
    };
  }

  async getPartnerStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        settings: true,
      },
    });

    return {
      asusPartnerCompleted: (tenant?.settings as any)?.asusPartnerCompleted || false,
      smartLinePartnerCompleted: (tenant?.settings as any)?.smartLinePartnerCompleted || false,
    };
  }
}
