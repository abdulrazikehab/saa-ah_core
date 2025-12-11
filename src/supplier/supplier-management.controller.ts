import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SupplierService, CreateSupplierDto, UpdateSupplierDto } from './supplier.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';

@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SupplierManagementController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() data: CreateSupplierDto) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.supplierService.create(tenantId, data);
  }

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.supplierService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.supplierService.findOne(tenantId, id);
  }

  @Put(':id')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() data: UpdateSupplierDto,
  ) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.supplierService.update(tenantId, id, data);
  }

  @Delete(':id')
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.supplierService.remove(tenantId, id);
  }
}

