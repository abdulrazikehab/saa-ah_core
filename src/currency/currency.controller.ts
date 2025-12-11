import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import {
  CurrencyService,
  CreateCurrencyDto,
  UpdateCurrencyDto,
  UpdateCurrencySettingsDto,
} from './currency.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../types/request.types';

@UseGuards(JwtAuthGuard)
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Post()
  async create(@Request() req: AuthenticatedRequest, @Body() data: CreateCurrencyDto) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.currencyService.create(tenantId, data);
  }

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.currencyService.findAll(tenantId);
  }

  @Get('settings')
  async getSettings(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId || req.user?.id;
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    return this.currencyService.getSettings(tenantId);
  }

  @Put('settings')
  async updateSettings(@Request() req: AuthenticatedRequest, @Body() data: UpdateCurrencySettingsDto) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.currencyService.updateSettings(tenantId, data);
  }

  @Put('rates')
  async updateRates(@Request() req: AuthenticatedRequest, @Body() rates: Record<string, number>) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.currencyService.updateExchangeRates(tenantId, rates);
  }

  @Get(':code')
  async findOne(@Request() req: AuthenticatedRequest, @Param('code') code: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.currencyService.findOne(tenantId, code);
  }

  @Put(':code')
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('code') code: string,
    @Body() data: UpdateCurrencyDto,
  ) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.currencyService.update(tenantId, code, data);
  }

  @Delete(':code')
  async remove(@Request() req: AuthenticatedRequest, @Param('code') code: string) {
    const tenantId = req.user.tenantId || req.user.id;
    return this.currencyService.remove(tenantId, code);
  }
}

