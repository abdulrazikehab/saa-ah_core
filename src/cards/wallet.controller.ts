import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantRequiredGuard } from '../guard/tenant-required.guard';
import { Public } from '../auth/public.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Request() req: any) {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      // Extract userId from token - could be from 'sub' field or 'id' field
      const userId = req.user?.id || req.user?.userId || req.user?.sub;
      
      if (!userId) {
        console.error('Wallet balance error: No user ID found in request', {
          user: req.user,
          headers: Object.keys(req.headers),
        });
        throw new BadRequestException('User ID is required');
      }
      
      // Log for debugging
      console.log('Wallet balance request:', {
        userId,
        tenantId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
      });
      
      if (!tenantId || tenantId === 'default' || tenantId === 'system') {
        // Return empty wallet if no tenant
        return {
          id: '',
          tenantId: '',
          userId: userId,
          balance: '0',
          currency: 'SAR',
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      const userData = {
        email: req.user?.email || '',
        name: req.user?.name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || '',
        role: req.user?.role || 'CUSTOMER',
      };
      
      // Get or create wallet for this specific user
      // This will create a User record in core DB if it doesn't exist, using the customer ID
      const wallet = await this.walletService.getOrCreateWallet(tenantId, userId, userData);
      
      console.log('Wallet retrieved:', {
        walletId: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
      });
      
      // Ensure balance is properly returned as a number/string
      return {
        ...wallet,
        balance: wallet.balance ? String(wallet.balance) : '0',
      };
    } catch (error: any) {
      console.error('Error getting wallet balance:', error);
      console.error('Request user:', req.user);
      // Return empty wallet on error
      return {
        id: '',
        tenantId: req.tenantId || req.user?.tenantId || '',
        userId: req.user?.id || req.user?.userId || req.user?.sub || '',
        balance: '0',
        currency: 'SAR',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    
    // Resolve user ID
    const user = await this.walletService.getOrCreateWallet(
      req.tenantId || req.user?.tenantId || 'default',
      userId,
      {
        email: req.user?.email || '',
        name: req.user?.name || '',
        role: req.user?.role || 'CUSTOMER',
      }
    );
    
    return this.walletService.getTransactions(
      user.userId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Public() // Allow customers to see merchant banks for wallet top-up
  @Get('banks')
  async getBanks(@Request() req: any) {
    // Get tenantId from request context (set by TenantMiddleware from subdomain/domain)
    // Fallback to user's tenantId or 'default' for development/system banks
    const tenantId = req.tenantId || req.user?.tenantId || 'default';
    
    // We only block 'system' tenant to prevent accidental exposure of system-level banks
    if (tenantId === 'system') {
      return [];
    }
    
    return this.walletService.getBanks(tenantId);
  }

  @Get('bank-accounts')
  async getBankAccounts(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID is required. Please ensure you are authenticated.');
      }
      
      // Resolve user ID to ensure we're using the one in the core database
      const user = await this.walletService.getOrCreateWallet(
        req.tenantId || req.user?.tenantId || 'default',
        userId,
        {
          email: req.user?.email || '',
          name: req.user?.name || '',
          role: req.user?.role || 'CUSTOMER',
        }
      );
      
      return await this.walletService.getUserBankAccounts(user.userId);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to get bank accounts');
    }
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
    try {
      const userId = req.user?.id || req.user?.userId || req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID is required. Please ensure you are authenticated.');
      }
      
      // Get tenantId and user data for syncing user if needed
      const tenantId = req.tenantId || req.user?.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
      const userData = {
        email: req.user?.email || '',
        name: req.user?.name || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || '',
        role: req.user?.role || 'CUSTOMER',
      };
      
      return await this.walletService.addBankAccount(userId, body, tenantId, userData);
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to add bank account');
    }
  }

  @Delete('bank-accounts/:id')
  async deleteBankAccount(@Request() req: any, @Param('id') id: string) {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?.sub;
      if (!userId) {
        throw new BadRequestException('User ID is required. Please ensure you are authenticated.');
      }

      // Resolve user ID
      const user = await this.walletService.getOrCreateWallet(
        req.tenantId || req.user?.tenantId || 'default',
        userId,
        {
          email: req.user?.email || '',
          name: req.user?.name || '',
          role: req.user?.role || 'CUSTOMER',
        }
      );

      // Verify the bank account belongs to the user
      const bankAccounts = await this.walletService.getUserBankAccounts(user.userId);
      const account = bankAccounts.find(acc => acc.id === id);
      
      if (!account) {
        throw new BadRequestException('Bank account not found or you do not have permission to delete it');
      }

      // Delete the bank account
      await this.walletService.deleteBankAccount(id);
      
      return { success: true, message: 'Bank account deleted successfully' };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to delete bank account');
    }
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
      req.user.id || req.user.userId,
      body,
    );
  }

  @Get('topup-requests')
  async getTopUpRequests(
    @Request() req: any,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
  ) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    
    // Resolve user ID
    const user = await this.walletService.getOrCreateWallet(
      req.tenantId || req.user?.tenantId || 'default',
      userId,
      {
        email: req.user?.email || '',
        name: req.user?.name || '',
        role: req.user?.role || 'CUSTOMER',
      }
    );
    
    return this.walletService.getTopUpRequests(user.userId, status);
  }

  @Get('admin/topups')
  async getAllTopUps(@Request() req: any) {
    const tenantId = req.user.tenantId || req.tenantId;
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      throw new BadRequestException('Tenant ID not found or invalid');
    }
    return this.walletService.getAllTopUpRequests(tenantId);
  }

  @Get('admin/pending-topups')
  async getPendingTopUps(@Request() req: any) {
    const tenantId = req.user.tenantId || req.tenantId;
    if (!tenantId || tenantId === 'default' || tenantId === 'system') {
      throw new BadRequestException('Tenant ID not found or invalid');
    }
    return this.walletService.getPendingTopUpRequests(tenantId);
  }

  @Post('admin/topup/:id/approve')
  async approveTopUp(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id || req.user.userId;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException('Authorization header is required');
    }
    const authToken = authHeader.substring(7);
    const tenantId = req.user.tenantId || req.tenantId;
    
    return this.walletService.approveTopUpRequest(id, userId, authToken, tenantId);
  }

  @Post('admin/topup/:id/reject')
  async rejectTopUp(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    const userId = req.user.id || req.user.userId;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException('Authorization header is required');
    }
    const authToken = authHeader.substring(7);
    const tenantId = req.user.tenantId || req.tenantId;
    
    return this.walletService.rejectTopUpRequest(id, userId, body.reason, authToken, tenantId);
  }
}
