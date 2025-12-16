import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate a secure API key
   * Format: bb_<random 32 bytes hex>_<timestamp>
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString(36);
    return `bb_${randomBytes}_${timestamp}`;
  }

  /**
   * Extract prefix from API key for lookup
   * Format: bb_<hash>_<timestamp> -> bb_<hash>
   */
  private getApiKeyPrefix(apiKey: string): string {
    const parts = apiKey.split('_');
    if (parts.length >= 3) {
      return `${parts[0]}_${parts[1]}`;
    }
    return apiKey.substring(0, 20); // Fallback to first 20 chars
  }

  /**
   * Hash the API key for storage
   */
  private async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, 10);
  }

  /**
   * Verify API key against hash
   */
  async verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hash);
  }

  /**
   * Create a new API key
   */
  async create(tenantId: string, dto: CreateApiKeyDto) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Generate API key
    const apiKey = this.generateApiKey();
    const apiKeyHash = await this.hashApiKey(apiKey);
    const apiKeyPrefix = this.getApiKeyPrefix(apiKey);

    // Store in database (only prefix for lookup, full key is hashed)
    const created = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        apiKey: apiKeyPrefix, // Store prefix for lookup only
        apiKeyHash: apiKeyHash,
        tenantId: tenantId,
        isActive: true,
      },
    });

    this.logger.log(`Created API key: ${created.id} for tenant: ${tenantId}`);

    // Return with the plain API key (only shown once)
    return {
      id: created.id,
      name: created.name,
      apiKey: apiKey, // Only returned on creation
      isActive: created.isActive,
      createdAt: created.createdAt,
      lastUsedAt: created.lastUsedAt,
    };
  }

  /**
   * Find all API keys for a tenant
   */
  async findAll(tenantId: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        // Never return the actual API key or hash
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys;
  }

  /**
   * Find one API key by ID
   */
  async findOne(tenantId: string, id: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  /**
   * Update an API key
   */
  async update(tenantId: string, id: string, dto: UpdateApiKeyDto) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Updated API key: ${id} for tenant: ${tenantId}`);
    return updated;
  }

  /**
   * Delete an API key
   */
  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id },
    });

    this.logger.log(`Deleted API key: ${id} for tenant: ${tenantId}`);
    return { message: 'API key deleted successfully' };
  }

  /**
   * Validate API key and return tenant info
   * Used by authentication guard
   */
  async validateApiKey(apiKey: string): Promise<{ tenantId: string; apiKeyId: string } | null> {
    // Extract prefix for lookup
    const apiKeyPrefix = this.getApiKeyPrefix(apiKey);

    // Find all API keys with matching prefix (since we only store prefix)
    const apiKeyRecords = await this.prisma.apiKey.findMany({
      where: {
        apiKey: apiKeyPrefix,
        isActive: true,
      },
      select: {
        id: true,
        apiKeyHash: true,
        tenantId: true,
        isActive: true,
      },
    });

    // Try to match against all records with same prefix
    for (const apiKeyRecord of apiKeyRecords) {
      const isValid = await this.verifyApiKey(apiKey, apiKeyRecord.apiKeyHash);
      if (isValid) {
        // Update last used timestamp
        await this.prisma.apiKey.update({
          where: { id: apiKeyRecord.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          tenantId: apiKeyRecord.tenantId,
          apiKeyId: apiKeyRecord.id,
        };
      }
    }

    return null;
  }

  /**
   * Regenerate API key (creates new key, invalidates old one)
   */
  async regenerate(tenantId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    // Generate new API key
    const newApiKey = this.generateApiKey();
    const newApiKeyHash = await this.hashApiKey(newApiKey);
    const newApiKeyPrefix = this.getApiKeyPrefix(newApiKey);

    // Update with new key
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        apiKey: newApiKeyPrefix, // Store prefix only
        apiKeyHash: newApiKeyHash,
        lastUsedAt: null, // Reset last used
      },
    });

    this.logger.log(`Regenerated API key: ${id} for tenant: ${tenantId}`);

    return {
      id: updated.id,
      name: updated.name,
      apiKey: newApiKey, // Only returned on regeneration
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      lastUsedAt: updated.lastUsedAt,
    };
  }

  /**
   * Admin methods - no tenant restrictions
   */

  /**
   * Find all API keys from all tenants (for system admin)
   */
  async findAllForAllTenants() {
    const apiKeys = await this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        tenantId: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys;
  }

  /**
   * Find one API key by ID (for admin, no tenant check)
   */
  async findOneForAdmin(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        tenantId: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }

  /**
   * Update an API key (for admin, no tenant check)
   */
  async updateForAdmin(id: string, dto: UpdateApiKeyDto) {
    const existing = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        name: true,
        tenantId: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            name: true,
            subdomain: true,
          },
        },
      },
    });

    this.logger.log(`Admin updated API key: ${id}`);
    return updated;
  }

  /**
   * Delete an API key (for admin, no tenant check)
   */
  async removeForAdmin(id: string) {
    const existing = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({
      where: { id },
    });

    this.logger.log(`Admin deleted API key: ${id}`);
    return { message: 'API key deleted successfully' };
  }

  /**
   * Regenerate API key (for admin, no tenant check)
   */
  async regenerateForAdmin(id: string) {
    const existing = await this.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    // Generate new API key
    const newApiKey = this.generateApiKey();
    const newApiKeyHash = await this.hashApiKey(newApiKey);
    const newApiKeyPrefix = this.getApiKeyPrefix(newApiKey);

    // Update with new key
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        apiKey: newApiKeyPrefix, // Store prefix only
        apiKeyHash: newApiKeyHash,
        lastUsedAt: null, // Reset last used
      },
    });

    this.logger.log(`Admin regenerated API key: ${id}`);

    return {
      id: updated.id,
      name: updated.name,
      apiKey: newApiKey, // Only returned on regeneration
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      lastUsedAt: updated.lastUsedAt,
    };
  }
}

