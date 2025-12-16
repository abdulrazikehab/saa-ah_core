import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard, TenantRequiredGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Request() req: any) {
    return this.walletService.getBalance(req.user.userId);
  }

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.walletService.getTransactions(
      req.user.userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('banks')
  async getBanks(@Request() req: any) {
    return this.walletService.getBanks(req.tenantId);
  }

  @Get('bank-accounts')
  async getBankAccounts(@Request() req: any) {
    return this.walletService.getUserBankAccounts(req.user.userId);
  }

  @Post('bank-accounts')
  async addBankAccount(
    @Request() req: any,
    @Body()
    body: {
      bankName: string;
      bankCode?: string;
      accountName: string;
      accountNumber: string;
      iban?: string;
      isDefault?: boolean;
    },
  ) {
    return this.walletService.addBankAccount(req.user.userId, body);
  }

  @Post('topup')
  async createTopUpRequest(
    @Request() req: any,
    @Body()
    body: {
      amount: number;
      currency?: string;
      paymentMethod: 'BANK_TRANSFER' | 'VISA' | 'MASTERCARD' | 'MADA' | 'APPLE_PAY' | 'STC_PAY';
      bankId?: string;
      senderAccountId?: string;
      senderName?: string;
      transferReference?: string;
      receiptImage?: string;
      notes?: string;
    },
  ) {
    return this.walletService.createTopUpRequest(
      req.tenantId,
      req.user.userId,
      body,
    );
  }

  @Get('topup-requests')
  async getTopUpRequests(
    @Request() req: any,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
  ) {
    return this.walletService.getTopUpRequests(req.user.userId, status);
  }

  @Get('admin/pending-topups')
  async getPendingTopUps(@Request() req: any) {
    return this.walletService.getPendingTopUpRequests(req.tenantId);
  }

  @Post('admin/topup/:id/approve')
  async approveTopUp(@Request() req: any, @Param('id') id: string) {
    return this.walletService.approveTopUpRequest(id, req.user.userId);
  }

  @Post('admin/topup/:id/reject')
  async rejectTopUp(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.walletService.rejectTopUpRequest(id, req.user.userId, body.reason);
  }
}

