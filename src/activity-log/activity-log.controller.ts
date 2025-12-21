import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivityLogService } from './activity-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('activity-log')
@UseGuards(JwtAuthGuard)
export class ActivityLogController {
  constructor(
    private readonly logs: ActivityLogService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async list(
    @Request() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('action') action?: string,
  ) {
    const tenantId = req.user?.tenantId || req.user?.id || req.tenantId;
    if (!tenantId) {
      return {
        logs: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const logs = await this.prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    const total = await this.prisma.activityLog.count({ where });

    const formattedLogs = logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      userId: log.actorId,
      metadata: typeof log.details === 'string' ? JSON.parse(log.details || '{}') : log.details || {},
      createdAt: log.createdAt,
      actor: log.actor ? {
        id: log.actor.id,
        email: log.actor.email,
        name: log.actor.name,
      } : null,
    }));

    return {
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
