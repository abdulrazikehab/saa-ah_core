// apps/app-core/src/user/user.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role: string;
  createdAt: Date;
  tenant?: {
    id: string;
    name: string;
    subdomain: string;
    plan: string;
    status: string;
  };
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  async getProfile(tenantId: string, userId: string): Promise<UserProfile> {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              plan: true,
              status: true,
            },
          },
        },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId} in tenant: ${tenantId}`);
        throw new NotFoundException('User not found');
      }

      // Remove sensitive data and format response
      const { password, ...userWithoutPassword } = user;
      
      return userWithoutPassword;
    } catch (error) {
      this.logger.error(`Error fetching user profile: ${error}`);
      throw error;
    }
  }

  async updateProfile(
    tenantId: string, 
    userId: string, 
    updateData: { email?: string; name?: string; avatar?: string }
  ) {
    try {
      // Verify user exists and belongs to tenant
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Check if email is already taken by another user in the same tenant
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findFirst({
          where: {
            email: updateData.email,
            tenantId,
            id: { not: userId },
          },
        });

        if (emailExists) {
          throw new NotFoundException('Email already taken');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`User profile updated: ${userId}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user profile: ${error}`);
      throw error;
    }
  }

  async getUserById(tenantId: string, userId: string) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error) {
      this.logger.error(`Error fetching user by ID: ${error}`);
      throw error;
    }
  }

  async getUsersByTenant(tenantId: string, page: number = 1, limit: number = 50) {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            tenantId,
          },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({
          where: { tenantId },
        }),
      ]);

      return {
        data: users,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching users by tenant: ${error}`);
      throw error;
    }
  }

  async updateUser(
    tenantId: string,
    userId: string,
    updateData: { email?: string; name?: string; role?: string; avatar?: string },
    updatedBy: string
  ) {
    try {
      // Verify user exists and belongs to tenant
      const existingUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
      });

      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      // Check if user has permission to update roles (only SHOP_OWNER or SUPER_ADMIN)
      if (updateData.role) {
        const updatingUser = await this.prisma.user.findFirst({
          where: {
            id: updatedBy,
            tenantId,
            role: { in: ['SHOP_OWNER', 'SUPER_ADMIN'] },
          },
        });

        if (!updatingUser) {
          throw new NotFoundException('Insufficient permissions to update user role');
        }
      }

      // Check if email is already taken by another user in the same tenant
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findFirst({
          where: {
            email: updateData.email,
            tenantId,
            id: { not: userId },
          },
        });

        if (emailExists) {
          throw new NotFoundException('Email already taken');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(updateData.email && { email: updateData.email }),
          ...(updateData.name !== undefined && { name: updateData.name }),
          ...(updateData.role && { role: updateData.role as any }),
          ...(updateData.avatar !== undefined && { avatar: updateData.avatar }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`User updated: ${userId} by ${updatedBy}`);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Error updating user: ${error}`);
      throw error;
    }
  }

  async deactivateUser(tenantId: string, userId: string, deactivatedBy: string) {
    try {
      // Verify user exists and belongs to tenant
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          tenantId,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent self-deactivation
      if (userId === deactivatedBy) {
        throw new NotFoundException('Cannot deactivate your own account');
      }

      // In a real scenario, you might soft delete or update status
      // For now, we'll just delete refresh tokens
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.log(`User deactivated: ${userId} by ${deactivatedBy}`);
      return { message: 'User deactivated successfully' };
    } catch (error) {
      this.logger.error(`Error deactivating user: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure user exists in core database (sync from auth database)
   * This is needed because users are created in auth database but merchants need them in core database
   */
  async ensureUserExists(userId: string, userData: { email: string; name?: string; role?: string; tenantId?: string }): Promise<any> {
    try {
      // Check if user already exists
      let user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        // Update user if data changed
        const updateData: any = {};
        if (userData.email && user.email !== userData.email) updateData.email = userData.email;
        if (userData.name && user.name !== userData.name) updateData.name = userData.name;
        if (userData.role && user.role !== userData.role) updateData.role = userData.role as any;
        
        // Only update tenantId if tenant exists (to avoid foreign key constraint)
        if (userData.tenantId && user.tenantId !== userData.tenantId) {
          // Retry check up to 3 times with small delay (handles potential transaction timing issues)
          let tenantExists = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            tenantExists = await this.prisma.tenant.findUnique({
              where: { id: userData.tenantId },
            });
            if (tenantExists) break;
            if (attempt < 2) {
              // Wait 100ms before retry (only if not last attempt)
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          if (tenantExists) {
            updateData.tenantId = userData.tenantId;
          } else {
            this.logger.warn(`Tenant ${userData.tenantId} does not exist after retries, skipping tenantId update for user ${userId}`);
          }
        }

        if (Object.keys(updateData).length > 0) {
          user = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
          });
          this.logger.log(`Updated user ${userId} in core database`);
        }
        return user;
      }

      // Create user if doesn't exist
      // Note: We don't have password in core database, it's only in auth database
      // Don't set tenantId initially to avoid foreign key constraint issues
      // We'll update it after tenant is confirmed to exist
      const createData: any = {
        id: userId,
        email: userData.email,
        name: userData.name,
        password: 'SYNCED_FROM_AUTH', // Placeholder - password is only in auth DB
        role: (userData.role as any) || 'SHOP_OWNER',
      };

      // Only set tenantId if tenant exists (to avoid foreign key constraint)
      if (userData.tenantId) {
        const tenantExists = await this.prisma.tenant.findUnique({
          where: { id: userData.tenantId },
        });
        if (tenantExists) {
          createData.tenantId = userData.tenantId;
        } else {
          this.logger.warn(`Tenant ${userData.tenantId} does not exist yet, creating user without tenantId`);
        }
      }

      user = await this.prisma.user.create({
        data: createData,
      });

      // If tenantId was provided but not set, update it now (tenant might have been created in parallel)
      if (userData.tenantId && !user.tenantId) {
        try {
          const tenantExists = await this.prisma.tenant.findUnique({
            where: { id: userData.tenantId },
          });
          if (tenantExists) {
            user = await this.prisma.user.update({
              where: { id: userId },
              data: { tenantId: userData.tenantId },
            });
            this.logger.log(`Updated user ${userId} with tenantId ${userData.tenantId}`);
          }
        } catch (updateError) {
          // Non-fatal - user is created, tenantId can be updated later
          this.logger.warn(`Could not update tenantId for user ${userId}: ${updateError}`);
        }
      }

      this.logger.log(`Created user ${userId} in core database (synced from auth)`);
      return user;
    } catch (error: any) {
      // If unique constraint error, user might have been created by another request
      if (error?.code === 'P2002') {
        this.logger.log(`User ${userId} was created by another request`);
        return await this.prisma.user.findUnique({ where: { id: userId } });
      }
      this.logger.error(`Error ensuring user exists: ${error}`);
      throw error;
    }
  }
}