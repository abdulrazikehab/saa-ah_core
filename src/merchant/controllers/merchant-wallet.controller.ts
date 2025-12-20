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

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      const context = await this.merchantService.validateMerchantAccess(userId);
      // Get wallet transactions for the merchant user (userId is the merchant's userId)
      const transactions = await this.walletService.getTransactions(
        userId, // Use the authenticated user's ID (which is the merchant's userId)
        parseInt(limit || '1') || 1,
        parseInt(limit || '50') || 50,
      );
      return transactions;
    } catch (error) {
      return { data: [], total: 0, page: 1, limit: 50, totalPages: 0 }; // Return empty structure if merchant access fails
    }
  }

  @Get('recharges')
  async getRecharges(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        throw new BadRequestException('User authentication required');
      }
      const context = await this.merchantService.validateMerchantAccess(userId);
      // Get wallet recharge requests for the merchant user (userId is the merchant's userId)
      const recharges = await this.walletService.getTopUpRequests(
        userId, // Use the authenticated user's ID (which is the merchant's userId)
        status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | undefined,
      );
      return Array.isArray(recharges) ? recharges : [];
    } catch (error) {
      return []; // Return empty array if merchant access fails
    }
  }

  @Post('recharge')
  @UseInterceptors(FileInterceptor('receiptImage', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Validate file types: jpeg, png, jpg, pdf
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
    const tenantId = req.tenantId;

    // Validate amount
    const amount = parseFloat(body.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    // Map payment method
    let paymentMethod: 'BANK_TRANSFER' | 'VISA' | 'MASTERCARD' | 'MADA' | 'APPLE_PAY' | 'STC_PAY' = 'BANK_TRANSFER';
    if (body.paymentMethod === 'visa') {
      paymentMethod = 'VISA';
    } else if (body.paymentMethod === 'cash') {
      paymentMethod = 'BANK_TRANSFER';
    }

    // Upload receipt image if provided
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

    // Get user data for wallet creation if needed
    const userData = req.user.email ? {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    } : undefined;

    // Create top-up request
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

