import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, Headers, Query } from '@nestjs/common';
import { BrandService, CreateBrandDto, UpdateBrandDto } from './brand.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';
import { Public } from '../auth/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() data: CreateBrandDto) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.brandService.create(tenantId, data);
  }

  @Public()
  @Get()
  async findAll(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    // Support both authenticated and public access
    // IMPORTANT: Never fall back to user.id as tenantId – it's not a valid tenant identifier.
    // Prefer an explicitly resolved tenantId (from middleware or header).
    const tenantId =
      req.tenantId ||
      req.user?.tenantId ||
      tenantIdHeader ||
      process.env.DEFAULT_TENANT_ID ||
      'default';

    if (!tenantId || tenantId === 'system') {
      // Return empty array if no valid tenant
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    return this.brandService.findAll(tenantId, pageNum, limitNum);
  }

  @Get(':id')
  async findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.brandService.findOne(tenantId, id);
  }

  @Get('code/:code')
  async findByCode(@Request() req: AuthenticatedRequest, @Param('code') code: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.brandService.findByCode(tenantId, code);
  }

  @Put(':id')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() data: UpdateBrandDto,
  ) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.brandService.update(tenantId, id, data);
  }

  @Delete(':id')
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.brandService.remove(tenantId, id);
  }
}

