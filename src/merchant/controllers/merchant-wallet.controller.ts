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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WalletService } from '../../cards/wallet.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MerchantService } from '../services/merchant.service';

@Controller('merchant/wallet')
@UseGuards(JwtAuthGuard)
export class MerchantWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly merchantService: MerchantService,
  ) {}

  @Get('balance')
  async getBalance(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      return this.walletService.getBalance(userId);
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
      const context = await this.merchantService.validateMerchantAccess(userId);
      return this.walletService.getBanks(context.tenantId);
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
      const context = await this.merchantService.validateMerchantAccess(userId);
      return this.walletService.getAllBanks(context.tenantId);
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
    const context = await this.merchantService.validateMerchantAccess(userId);

    let logoUrl: string | undefined;
    if (logoFile) {
      const uploadResult = await this.cloudinaryService.uploadFile(logoFile);
      logoUrl = uploadResult.secure_url || uploadResult.url;
    }

    return this.walletService.createBank(context.tenantId, {
      ...body,
      logo: logoUrl,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
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
    const context = await this.merchantService.validateMerchantAccess(userId);

    const updateData: any = { ...body };
    if (logoFile) {
      const uploadResult = await this.cloudinaryService.uploadFile(logoFile);
      updateData.logo = uploadResult.secure_url || uploadResult.url;
    }

    return this.walletService.updateBank(context.tenantId, id, updateData);
  }

  @Post('banks/:id/delete')
  async deleteBank(@Request() req: any, @Param('id') id: string) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    const context = await this.merchantService.validateMerchantAccess(userId);
    return this.walletService.deleteBank(context.tenantId, id);
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
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      return this.walletService.getTransactions(userId, pageNum, limitNum);
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
      return this.walletService.getUserBankAccounts(userId);
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
    return this.walletService.addBankAccount(userId, body);
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
      return this.walletService.getTopUpRequests(userId, status);
    } catch (error) {
      return [];
    }
  }

  @Get('admin/pending-topups')
  async getPendingTopUps(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }
    const context = await this.merchantService.validateMerchantAccess(userId);
    return this.walletService.getPendingTopUpRequests(context.tenantId);
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
    const tenantId = context.tenantId;
    
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
    
    const context = await this.merchantService.validateMerchantAccess(userId);
    const tenantId = context.tenantId;
    
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

    let receiptImageUrl: string | undefined;
    if (file) {
      try {
        const uploadResult = await this.cloudinaryService.uploadImage(
          file,
          `tenants/${tenantId}/wallet-receipts`,
        );
        receiptImageUrl = uploadResult.secureUrl;
      } catch (error) {
        throw new BadRequestException(`Failed to upload receipt image: ${error}`);
      }
    }

    const userData = req.user.email ? {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    } : undefined;

    const topUpRequest = await this.walletService.createTopUpRequest(
      tenantId,
      userId,
      {
        amount,
        currency: body.currency || 'SAR',
        paymentMethod,
        bankId: body.bankId,
        senderAccountId: body.senderAccountId,
        receiptImage: receiptImageUrl,
      },
      userData,
    );

    return {
      success: true,
      message: 'Wallet recharge request submitted successfully',
      data: topUpRequest,
    };
  }
}

