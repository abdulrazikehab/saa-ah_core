import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, BadRequestException, Logger } from '@nestjs/common';
import { SupplierService, CreateSupplierDto, UpdateSupplierDto } from './supplier.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';

@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SupplierManagementController {
  private readonly logger = new Logger(SupplierManagementController.name);

  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() data: CreateSupplierDto) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.supplierService.create(tenantId, data);
  }

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    try {
      // TenantRequiredGuard should have already validated tenantId
      const tenantId = req.user?.tenantId || req.tenantId;
      if (!tenantId) {
        this.logger.warn('Tenant ID missing in request', { user: req.user, tenantId: req.tenantId });
        throw new BadRequestException('Tenant ID is required. Please ensure you are authenticated.');
      }
      return this.supplierService.findAll(tenantId);
    } catch (error: any) {
      this.logger.error('Error in findAll suppliers:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to fetch suppliers: ${error?.message || 'Unknown error'}`);
    }
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

