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

@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogController {
  constructor(
    private readonly logs: ActivityLogService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  async list(
    @Request() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const data = await this.logs.findMany(req.user.tenantId, skip, limit);
    const total = await this.prisma.activityLog.count({
      where: { tenantId: req.user.tenantId },
    });
    return { data, meta: { page, limit, total } };
  }
}
