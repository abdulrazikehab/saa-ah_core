import { Controller, Get, Post, Query, Param, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionStatus } from '@prisma/client';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // Get tenant balance summary
  @Get('balance')
  async getBalance(@Query('tenantId') tenantId: string) {
    return this.transactionService.getTenantBalance(tenantId);
  }

  // Get list of transactions with optional filters
  @Get()
  async getTransactions(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: TransactionStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ) {
    return this.transactionService.getTransactions(tenantId, {
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });
  }

  // Get single transaction details
  @Get(':id')
  async getTransaction(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    return this.transactionService.getTransactionById(tenantId, id);
  }

  // Get transaction statistics (for charts)
  @Get('stats')
  async getStats(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionService.getTransactionStats(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // Get subscription info
  @Get('subscription')
  async getSubscription(@Query('tenantId') tenantId: string) {
    return this.transactionService.getSubscriptionInfo(tenantId);
  }

  // Reprint transaction receipt and increment print count
  @Post(':id/reprint')
  async reprintTransaction(
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    return this.transactionService.reprintTransaction(tenantId, id);
  }
}
