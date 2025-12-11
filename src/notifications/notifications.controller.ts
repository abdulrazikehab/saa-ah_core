import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { AuthenticatedRequest } from '../types/request.types';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('settings')
  async getSettings(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId || 'default';
    return this.notificationsService.getSettings(tenantId);
  }

  @Put('settings')
  async updateSettings(@Request() req: AuthenticatedRequest, @Body() settings: any) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId || 'default';
    return this.notificationsService.updateSettings(tenantId, settings);
  }
}

