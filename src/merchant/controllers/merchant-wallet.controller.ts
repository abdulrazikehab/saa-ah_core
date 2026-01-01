import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Request,
  UseGuards,
  BadRequestException,
  Query,
  Param,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WalletService } from '../../cards/wallet.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MerchantService } from '../services/merchant.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('merchant/wallet')
@UseGuards(JwtAuthGuard)
export class MerchantWalletController {
  private readonly logger = new Logger(MerchantWalletController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly merchantService: MerchantService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('balance')
  async getBalance(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      // Ensure merchant and wallet exist
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      return this.walletService.getBalance(context?.userId || userId);
    } catch (error) {
      throw error;
    }
  }

  @Get('banks')
  async getBanks(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      return this.walletService.getBanks(context?.tenantId || req.user?.tenantId || 'default');
    } catch (error) {
      return []; // Return empty array if merchant access fails
    }
  }

  @Get('banks/all')
  async getAllBanks(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      return this.walletService.getAllBanks(context?.tenantId || req.user?.tenantId || 'default');
    } catch (error) {
      return [];
    }
  }

  @Post('banks')
  @UseInterceptors(FileInterceptor('logo'))
  async createBank(
    @Request() req: any,
    @Body() body: {
      name: string;
      nameAr?: string;
      code: string;
      accountName: string;
      accountNumber: string;
      iban: string;
      swiftCode?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    @UploadedFile() logoFile?: Express.Multer.File,
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // Check if user has a tenant before proceeding
    if (!req.user?.tenantId) {
      throw new BadRequestException(
        'You need to create a store/market first before adding bank accounts. ' +
        'Please complete the store setup from the dashboard.'
      );
    }

    // Ensure user data is complete for sync
    // Note: JWT doesn't include 'name', so we'll fetch it from database if needed
    const userData = {
      email: req.user?.email || '',
      name: req.user?.name, // May be undefined from JWT
      role: req.user?.role || 'SHOP_OWNER',
      tenantId: req.user?.tenantId,
    };

    // Validate required fields
    if (!userData.email) {
      throw new BadRequestException('User email is required. Please log out and log in again.');
    }

    if (!userData.tenantId) {
      throw new BadRequestException(
        'Your session does not have a store/market assigned. ' +
        'Please log out and log back in after creating your store, or refresh the page.'
      );
    }

    let context;
    try {
      context = await this.merchantService.validateMerchantAccess(userId, undefined, userData);
    } catch (error: any) {
      // Provide more helpful error message
      if (error.message?.includes('store/market') || 
          error.message?.includes('create a store') ||
          error.message?.includes('log out and log')) {
        throw error; // Re-throw as-is if it's already a helpful message
      }
      
      // Check if it's a user sync issue
      if (error.message?.includes('ensure user exists') || error.message?.includes('sync')) {
        // If it's a specific email conflict, show that message
        if (error.message?.includes('Email') || error.message?.includes('already used')) {
          throw error;
        }
        
        throw new BadRequestException(
          'Failed to sync your account. Please log out and log back in to refresh your session, ' +
          'or contact support if the issue persists.'
        );
      }
      
      throw new BadRequestException(
        `Failed to access merchant account: ${error.message || 'Unknown error'}. ` +
        `Please ensure you have created a store/market first and try logging out and back in.`
      );
    }

    let logoUrl: string | undefined;
    if (logoFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(logoFile);
      logoUrl = uploadResult.secureUrl || uploadResult.url;
    }

    // Convert string values to proper types (form data sends everything as strings)
    const isActive = typeof body.isActive === 'string' 
      ? body.isActive === 'true' || body.isActive === '1'
      : body.isActive ?? true;
    
    const sortOrder = typeof body.sortOrder === 'string'
      ? parseInt(body.sortOrder, 10) || 0
      : body.sortOrder ?? 0;

    return this.walletService.createBank(context.tenantId, {
      ...body,
      logo: logoUrl,
      isActive,
      sortOrder,
    });
  }

  @Post('banks/:id')
  @UseInterceptors(FileInterceptor('logo'))
  async updateBank(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      nameAr?: string;
      code?: string;
      accountName?: string;
      accountNumber?: string;
      iban?: string;
      swiftCode?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
    @UploadedFile() logoFile?: Express.Multer.File,
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);

    const updateData: any = { ...body };
    
    // Convert string values to proper types (form data sends everything as strings)
    if (updateData.isActive !== undefined) {
      updateData.isActive = typeof updateData.isActive === 'string' 
        ? updateData.isActive === 'true' || updateData.isActive === '1'
        : updateData.isActive;
    }
    
    if (updateData.sortOrder !== undefined) {
      updateData.sortOrder = typeof updateData.sortOrder === 'string'
        ? parseInt(updateData.sortOrder, 10) || 0
        : updateData.sortOrder;
    }
    
    if (logoFile) {
      const uploadResult = await this.cloudinaryService.uploadImage(logoFile);
      updateData.logo = uploadResult.secureUrl || uploadResult.url;
    }

    return this.walletService.updateBank(context?.tenantId || req.user?.tenantId || 'default', id, updateData);
  }

  @Post('banks/:id/delete')
  async deleteBank(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
    return this.walletService.deleteBank(context?.tenantId || req.user?.tenantId || 'default', id);
  }

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      // Ensure merchant and wallet exist
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      return this.walletService.getTransactions(context?.userId || userId, pageNum, limitNum);
    } catch (error) {
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }

  @Get('bank-accounts')
  async getBankAccounts(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      // Ensure merchant and wallet exist
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      return this.walletService.getUserBankAccounts(context?.userId || userId);
    } catch (error) {
      return [];
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
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    // Ensure merchant and wallet exist
    const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
    return this.walletService.addBankAccount(userId, body, context?.tenantId || req.user?.tenantId || 'default', req.user);
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
    const userId = req.user?.id || req.user?.userId;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!userId || !tenantId) {
      throw new BadRequestException('User authentication required');
    }
    
    const userData = req.user.email ? {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    } : undefined;

    return this.walletService.createTopUpRequest(tenantId, userId, body, userData);
  }

  @Get('topup-requests')
  async getTopUpRequests(
    @Request() req: any,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
  ) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      // Ensure merchant and wallet exist
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      return this.walletService.getTopUpRequests(context?.userId || userId, status);
    } catch (error) {
      return [];
    }
  }

  @Get('staff-list')
  async getStaffListForCustomer(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // Check if user is CUSTOMER
    const isCustomer = req.user?.type === 'customer' || req.user?.role === 'CUSTOMER';
    
    if (!isCustomer) {
      throw new BadRequestException('Only customers can access staff list');
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Get staff users from auth service
    // We'll need to call the auth service to get staff list
    // For now, return empty array - this should be implemented by calling auth service
    // or we can query the core database if staff users are synced there
    try {
      // Try to get staff from core database (if they're synced)
      const staffUsers = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: 'STAFF',
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      return {
        data: staffUsers,
      };
    } catch (error) {
      this.logger.error('Failed to get staff list:', error);
      return { data: [] };
    }
  }

  @Post('admin/give-balance')
  async giveBalanceToStaff(
    @Request() req: any,
    @Body() body: {
      staffId: string;
      amount: number;
      description?: string;
      descriptionAr?: string;
    },
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    // Check if user is CUSTOMER (customer giving balance to their employees)
    const isCustomer = req.user?.type === 'customer' || req.user?.role === 'CUSTOMER';
    
    if (!isCustomer) {
      throw new BadRequestException('Only customers can give balance to their employees');
    }

    // Get tenantId from customer's tenantId
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Verify that the staff user belongs to the same tenant
    // We need to check if staffId exists in the auth database as STAFF role for this tenant
    // For now, we'll trust the staffId and let the wallet service handle it
    
    if (!body.staffId || !body.amount || body.amount <= 0) {
      throw new BadRequestException('Invalid staff ID or amount');
    }

    // Credit the staff's wallet (staffId is the userId of the staff member)
    const result = await this.walletService.credit(
      body.staffId,
      body.amount,
      body.description || `Balance added by customer`,
      body.descriptionAr || `تم إضافة رصيد بواسطة عميل`,
      undefined,
      'ADJUSTMENT',
    );

    this.logger.log(`Balance ${body.amount} given to staff ${body.staffId} by customer ${userId}`);

    return {
      success: true,
      message: 'Balance added successfully',
      wallet: result.wallet,
      transaction: result.transaction,
    };
  }

  @Get('admin/topups')
  async getAllTopUps(@Request() req: any) {
    console.log('✅ GET /merchant/wallet/admin/topups - Route hit!');
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
      console.log('✅ Tenant ID:', context?.tenantId);
      const requests = await this.walletService.getAllTopUpRequests(context?.tenantId || req.user?.tenantId || 'default');
      console.log('✅ Returning', requests.length, 'top-up requests');
      return requests;
    } catch (error) {
      console.error('❌ Error in getAllTopUps:', error);
      throw error;
    }
  }

  @Get('admin/pending-topups')
  async getPendingTopUps(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
    return this.walletService.getPendingTopUpRequests(context?.tenantId || req.user?.tenantId || 'default');
  }

  @Post('admin/topup/:id/approve')
  async approveTopUp(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException('Authorization header is required');
    }
    const authToken = authHeader.substring(7);
    
    const context = await this.merchantService.validateMerchantAccess(userId);
    const tenantId = context?.tenantId || req.user?.tenantId || 'default';
    
    return this.walletService.approveTopUpRequest(id, userId, authToken, tenantId);
  }

  @Post('admin/topup/:id/reject')
  async rejectTopUp(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException('Authorization header is required');
    }
    const authToken = authHeader.substring(7);
    
    const context = await this.merchantService.validateMerchantAccess(userId, undefined, req.user);
    const tenantId = context?.tenantId || req.user?.tenantId || 'default';
    
    return this.walletService.rejectTopUpRequest(id, userId, body.reason, authToken, tenantId);
  }

  // Legacy endpoint - kept for backward compatibility
  @Post('recharge')
  @UseInterceptors(FileInterceptor('receiptImage', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/pdf',
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type ${file.mimetype} is not allowed. Only jpeg, png, jpg, and pdf are allowed.`), false);
      }
    },
  }))
  async recharge(
    @Request() req: any,
    @Body() body: {
      paymentMethod?: string;
      bankId?: string;
      amount: string;
      currency?: string;
      senderAccountId?: string;
      senderName?: string;
      transferrerName?: string; // Support both names
    },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.user?.tenantId || req.tenantId;

    const amount = parseFloat(body.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    let paymentMethod: 'BANK_TRANSFER' | 'VISA' | 'MASTERCARD' | 'MADA' | 'APPLE_PAY' | 'STC_PAY' = 'BANK_TRANSFER';
    if (body.paymentMethod === 'visa') {
      paymentMethod = 'VISA';
    } else if (body.paymentMethod === 'cash') {
      paymentMethod = 'BANK_TRANSFER';
    }

    const userData = req.user.email ? {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    } : undefined;

    // Create the top-up request immediately without waiting for image upload
    const topUpRequest = await this.walletService.createTopUpRequest(
      tenantId,
      userId,
      {
        amount,
        currency: body.currency || 'SAR',
        paymentMethod,
        bankId: body.bankId,
        senderAccountId: body.senderAccountId,
        senderName: body.senderName || body.transferrerName,
        receiptImage: undefined, // Will be updated after upload
      },
      userData,
    );

    // Upload image asynchronously in the background (non-blocking)
    if (file) {
      // Don't await - let it run in the background
      this.cloudinaryService.uploadImage(
        file,
        `tenants/${tenantId}/wallet-receipts`,
      ).then((uploadResult) => {
        // Update the top-up request with the image URL once upload completes
        return this.prisma.walletTopUpRequest.update({
          where: { id: topUpRequest.id },
          data: { receiptImage: uploadResult.secureUrl },
        });
      }).catch((error) => {
        // Log error but don't fail the request
        this.logger.error(`Failed to upload receipt image for top-up request ${topUpRequest.id}:`, error);
      });
    }

    return {
      success: true,
      message: 'Wallet recharge request submitted successfully',
      data: topUpRequest,
    };
  }
}

