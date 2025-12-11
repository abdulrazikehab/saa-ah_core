import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    const settings = (tenant?.settings as any)?.notifications || {
      emailNotifications: true,
      orderNotifications: true,
      customerNotifications: true,
      inventoryNotifications: true,
      marketingNotifications: false,
      pushNotifications: false,
    };

    return settings;
  }

  async updateSettings(tenantId: string, settings: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    const currentSettings = (tenant?.settings as any) || {};
    const newSettings = {
      ...currentSettings,
      notifications: {
        ...(currentSettings.notifications || {}),
        ...settings
      }
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: newSettings }
    });

    return newSettings.notifications;
  }
}

