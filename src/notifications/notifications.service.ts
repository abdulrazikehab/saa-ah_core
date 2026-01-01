import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { NotificationsGateway } from './notifications.gateway';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private notificationsGateway: NotificationsGateway,
  ) {}

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

  async findAll(tenantId: string, userId?: string) {
    try {
      if (!userId) return [];
      
      return await this.prisma.notification.findMany({
        where: { tenantId, userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async create(data: {
    tenantId: string;
    userId: string;
    type: string;
    titleEn: string;
    titleAr?: string;
    bodyEn: string;
    bodyAr?: string;
    data?: any;
  }) {
    const notification = await this.prisma.notification.create({
      data,
    });

    // Send real-time notification
    this.notificationsGateway.sendToUser(data.userId, 'notification', notification);

    return notification;
  }

  async sendNotification(params: {
    tenantId: string;
    userId?: string; // Target user (e.g. merchant admin)
    type: 'ORDER' | 'CUSTOMER' | 'INVENTORY' | 'MARKETING';
    titleEn: string;
    titleAr?: string;
    bodyEn: string;
    bodyAr?: string;
    data?: any;
  }) {
    const { tenantId, type, titleEn, titleAr, bodyEn, bodyAr, data } = params;

    // 1. Get tenant settings
    const settings = await this.getSettings(tenantId);

    // 2. Check if this type of notification is enabled
    const isEnabled = 
      (type === 'ORDER' && settings.orderNotifications) ||
      (type === 'CUSTOMER' && settings.customerNotifications) ||
      (type === 'INVENTORY' && settings.inventoryNotifications) ||
      (type === 'MARKETING' && settings.marketingNotifications);

    if (!isEnabled) {
      this.logger.log(`Notification type ${type} is disabled for tenant ${tenantId}`);
      return;
    }

    // 3. Find target users (merchant admins/staff) if userId not provided
    let targetUserIds: string[] = [];
    if (params.userId) {
      targetUserIds = [params.userId];
    } else {
      const staff = await this.prisma.user.findMany({
        where: { 
          tenantId,
          role: { in: ['SHOP_OWNER', 'STAFF'] }
        },
        select: { id: true }
      });
      targetUserIds = staff.map(u => u.id);
    }

    // 4. Create in-app notifications and send real-time
    for (const userId of targetUserIds) {
      await this.create({
        tenantId,
        userId,
        type,
        titleEn,
        titleAr,
        bodyEn,
        bodyAr,
        data
      });
    }

    // 5. Send email if enabled
    if (settings.emailNotifications) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { email: true, name: true }
      });

      if (tenant?.email) {
        const authServiceUrl = process.env.AUTH_API_URL || process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
        try {
          await firstValueFrom(
            this.httpService.post(`${authServiceUrl}/email/send`, {
              to: tenant.email,
              subject: titleAr || titleEn,
              html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>${titleAr || titleEn}</h2>
                  <p>${bodyAr || bodyEn}</p>
                  <hr>
                  <p style="font-size: 12px; color: #666;">تم إرسال هذا البريد الإلكتروني تلقائياً من منصة سعة.</p>
                </div>
              `
            })
          );
          this.logger.log(`Email notification sent to ${tenant.email} for tenant ${tenantId}`);
        } catch (error: any) {
          this.logger.error(`Failed to send email notification: ${error.message}`);
        }
      }
    }
  }

  async markAsRead(id: string) {
    return await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(tenantId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

