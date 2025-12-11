import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BrandService, CreateBrandDto, UpdateBrandDto } from './brand.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';

@UseGuards(JwtAuthGuard)
@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() data: CreateBrandDto) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.brandService.create(tenantId, data);
  }

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.brandService.findAll(tenantId);
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

