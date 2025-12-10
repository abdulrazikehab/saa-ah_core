import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantSyncService } from '../tenant/tenant-sync.service';

@Injectable()
export class PageService {
  constructor(
    private prisma: PrismaService,
    private tenantSyncService: TenantSyncService,
  ) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  private async ensureUniqueSlug(tenantId: string, baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.page.findFirst({
        where: {
          tenantId,
          slug,
          ...(excludeId && { NOT: { id: excludeId } }),
        },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async create(tenantId: string, data: any) {
    await this.tenantSyncService.ensureTenantExists(tenantId);

    // Auto-generate slug from title if not provided or empty
    let slug = data.slug?.trim();
    if (!slug) {
      slug = this.generateSlug(data.title || 'page');
    } else {
      // Clean the provided slug
      slug = this.generateSlug(slug);
    }

    // Ensure slug is unique
    slug = await this.ensureUniqueSlug(tenantId, slug);

    return this.prisma.page.create({
      data: {
        ...data,
        slug,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.page.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const page = await this.prisma.page.findFirst({
      where: { id, tenantId },
    });

    if (!page) {
      throw new NotFoundException(`Page with ID ${id} not found`);
    }

    return page;
  }

  async findBySlug(tenantId: string, slug: string) {
    const page = await this.prisma.page.findFirst({
      where: { slug, tenantId },
    });

    if (!page) {
      throw new NotFoundException(`Page with slug ${slug} not found`);
    }

    return page;
  }

  async update(tenantId: string, id: string, data: any) {
    const page = await this.findOne(tenantId, id);

    // Handle slug update
    if (data.slug !== undefined) {
      let slug = data.slug?.trim();
      
      if (!slug && data.title) {
        // If slug is empty but title is provided, generate from title
        slug = this.generateSlug(data.title);
      } else if (slug) {
        // Clean the provided slug
        slug = this.generateSlug(slug);
      }

      if (slug) {
        // Ensure slug is unique (excluding current page)
        slug = await this.ensureUniqueSlug(tenantId, slug, id);
        data.slug = slug;
      }
    }

    // Create history if publishing
    if (data.isPublished === true && data.content) {
       const historyRecords = await this.prisma.pageHistory.findMany({ where: { pageId: id } });
       await this.prisma.pageHistory.create({
         data: {
           pageId: id,
           content: data.content as any, // Save the NEW content being published
           version: historyRecords.length + 1
         }
       });
    }

    return this.prisma.page.update({
      where: { id },
      data,
    });
  }

  async getHistory(tenantId: string, pageId: string) {
    await this.findOne(tenantId, pageId);
    return this.prisma.pageHistory.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async restoreVersion(tenantId: string, pageId: string, historyId: string) {
    const page = await this.findOne(tenantId, pageId);
    const history = await this.prisma.pageHistory.findUnique({
      where: { id: historyId }
    });
    
    if (!history || history.pageId !== pageId) {
      throw new NotFoundException('History version not found');
    }

    // Restore to draftContent
    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        draftContent: history.content as any
      }
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.page.delete({
      where: { id },
    });
  }
}
