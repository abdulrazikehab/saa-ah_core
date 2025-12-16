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
}