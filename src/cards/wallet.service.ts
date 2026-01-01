import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private httpService: HttpService,
    private notificationsService: NotificationsService,
  ) {}

  // Get or create wallet for user
  async getOrCreateWallet(tenantId: string, userId: string, userData?: { email?: string; name?: string; role?: string }) {
    this.logger.log(`Getting or creating wallet for userId: ${userId}, tenantId: ${tenantId}, email: ${userData?.email}, role: ${userData?.role}`);
    
    // For customers, we MUST use the userId from the token (customer.id) directly
    // Do NOT look up by email as that could cause multiple customers to share the same wallet
    const isCustomer = userData?.role === 'CUSTOMER' || !userData?.role;
    
    // Ensure user exists in core database (sync from auth if needed)
    const user = await this.userService.ensureUserExists(userId, {
      email: userData?.email || `customer-${userId}@temp.local`,
      name: userData?.name || 'Customer',
      role: userData?.role || 'CUSTOMER',
      tenantId: tenantId,
    });
    
    if (!user) {
      this.logger.error(`Failed to create or find user ${userId}`);
      throw new NotFoundException(`User ${userId} not found and could not be created.`);
    }

    const actualUserId = user.id;

    // Look up wallet by the actual database userId
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId: actualUserId },
    });

    if (!wallet) {
      this.logger.log(`Wallet not found for userId ${actualUserId}, creating new wallet with balance 0`);
      wallet = await this.prisma.wallet.create({
        data: {
          tenantId,
          userId: actualUserId,
          balance: 0,
          currency: 'SAR',
        },
      });
      this.logger.log(`Created new wallet ${wallet.id} for user ${actualUserId} with balance 0`);
    } else {
      this.logger.log(`Found existing wallet ${wallet.id} for user ${actualUserId} with balance ${wallet.balance}`);
    }

    return wallet;
  }

  // Get wallet balance
  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  // Get wallet transactions
  async getTransactions(userId: string, page: number = 1, limit: number = 20) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Credit wallet (add funds)
  async credit(
    userId: string,
    amount: number,
    description: string,
    descriptionAr: string,
    reference?: string,
    type: 'TOPUP' | 'REFUND' | 'BONUS' | 'ADJUSTMENT' = 'TOPUP',
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = new Decimal(balanceBefore).plus(amount);

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          description,
          descriptionAr,
          reference,
          status: 'COMPLETED',
        },
      }),
    ]);

    this.logger.log(`Credited ${amount} to wallet ${wallet.id}. New balance: ${balanceAfter}`);

    return { wallet: updatedWallet, transaction };
  }

  // Debit wallet (subtract funds for purchase)
  async debit(
    userId: string,
    amount: number,
    description: string,
    descriptionAr: string,
    reference?: string,
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balanceBefore = wallet.balance;
    if (new Decimal(balanceBefore).lessThan(amount)) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const balanceAfter = new Decimal(balanceBefore).minus(amount);

    const [updatedWallet, transaction] = await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
      this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amount: -amount, // Negative for debit
          balanceBefore,
          balanceAfter,
          currency: wallet.currency,
          description,
          descriptionAr,
          reference,
          status: 'COMPLETED',
        },
      }),
    ]);

    this.logger.log(`Debited ${amount} from wallet ${wallet.id}. New balance: ${balanceAfter}`);

    return { wallet: updatedWallet, transaction };
  }

  // Check if user has sufficient balance
  async hasSufficientBalance(userId: string, amount: number): Promise<boolean> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return false;
    }

    return new Decimal(wallet.balance).greaterThanOrEqualTo(amount);
  }

  // Create top-up request
  async createTopUpRequest(
    tenantId: string,
    userId: string,
    data: {
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
    userData?: { email?: string; name?: string; role?: string },
  ) {
    // Resolve user ID to ensure we're using the one in the core database
    const user = await this.userService.ensureUserExists(userId, {
      email: userData?.email || `customer-${userId}@temp.local`,
      name: userData?.name || 'Customer',
      role: userData?.role || 'CUSTOMER',
      tenantId: tenantId,
    });
    
    const actualUserId = user.id;

    // Validate bankId if provided
    let validBankId: string | undefined = undefined;
    if (data.bankId) {
      const bank = await this.prisma.bank.findUnique({
        where: { id: data.bankId },
      });
      if (!bank) {
        this.logger.warn(`Bank ${data.bankId} not found, setting bankId to null`);
        validBankId = undefined;
      } else {
        validBankId = data.bankId;
      }
    }

    const request = await this.prisma.walletTopUpRequest.create({
      data: {
        tenantId,
        userId: actualUserId,
        amount: data.amount,
        currency: data.currency || 'SAR',
        paymentMethod: data.paymentMethod,
        bankId: validBankId, // Only set if bank exists
        senderAccountId: data.senderAccountId,
        senderName: data.senderName,
        transferReference: data.transferReference,
        receiptImage: data.receiptImage,
        notes: data.notes,
        status: 'PENDING',
      },
      include: {
        bank: true,
        senderAccount: true,
      },
    });

    this.logger.log(`Created top-up request ${request.id} for user ${actualUserId}`);

    return request;
  }

  async getTopUpRequests(userId: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED') {
    const where: any = { userId };
    if (status) {
      where.status = status;
    }

    return this.prisma.walletTopUpRequest.findMany({
      where,
      include: {
        bank: true,
        senderAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get all pending top-up requests for admin
  async getPendingTopUpRequests(tenantId: string) {
    return this.prisma.walletTopUpRequest.findMany({
      where: {
        tenantId,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        bank: true,
        senderAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get all top-up requests for admin (all statuses)
  async getAllTopUpRequests(tenantId: string) {
    const requests = await this.prisma.walletTopUpRequest.findMany({
      where: {
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        bank: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            accountNumber: true,
            accountName: true,
          },
        },
        senderAccount: {
          select: {
            id: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map the data to match frontend expectations
    return requests.map((request) => ({
      ...request,
      amount: Number(request.amount),
      proofImage: request.receiptImage, // Map receiptImage to proofImage for frontend compatibility
    }));
  }

  // Approve top-up request (admin action)
  async approveTopUpRequest(requestId: string, processedByUserId: string, authToken: string, tenantId: string) {
    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Top-up request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    // IMPORTANT: Credit wallet to the user who requested the top-up (request.userId)
    // NOT the admin who approves it (processedByUserId)
    // The admin is just approving the request, the money should go to the requester
    this.logger.log(`Approving top-up request ${requestId}: Adding ${request.amount} to user ${request.userId} (processed by admin ${processedByUserId})`);
    
    // Credit wallet and update request first (this is the primary operation)
    const { wallet, transaction } = await this.credit(
      request.userId, // Add balance to the user who requested the top-up
      Number(request.amount),
      `Wallet top-up approved`,
      `تم شحن الرصيد`,
      requestId,
      'TOPUP',
    );

    // Verify the balance was added correctly
    this.logger.log(`Wallet credited successfully. User ${request.userId} new balance: ${wallet.balance}`);

    // Update request status
    const updatedRequest = await this.prisma.walletTopUpRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        processedAt: new Date(),
        processedByUserId, // This is just for tracking who approved it
      },
    });

    // Link transaction to top-up request
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: { topUpRequestId: requestId },
    });

    this.logger.log(`Approved top-up request ${requestId} and credited ${request.amount} to wallet of user ${request.userId}`);

    // DO NOT call external API again - it would cause duplicate processing
    // The external API call should only happen from the frontend/merchant API
    // If we're being called from merchant API, we don't need to call it back

    return { request: updatedRequest, wallet, transaction };
  }

  // Reject top-up request (admin action)
  async rejectTopUpRequest(requestId: string, processedByUserId: string, reason: string, authToken: string, tenantId: string) {
    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Top-up request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    const updatedRequest = await this.prisma.walletTopUpRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        processedAt: new Date(),
        processedByUserId,
        rejectionReason: reason,
      },
    });

    this.logger.log(`Rejected top-up request ${requestId}: ${reason}`);

    // Create notification for the user about the rejection
    try {
      await this.notificationsService.create({
        tenantId: request.tenantId,
        userId: request.userId,
        type: 'WALLET_TOPUP_REJECTED',
        titleEn: 'Top-up Request Rejected',
        titleAr: 'تم رفض طلب شحن الرصيد',
        bodyEn: `Your top-up request of ${request.amount} ${request.currency} has been rejected. Reason: ${reason}`,
        bodyAr: `تم رفض طلب شحن الرصيد بقيمة ${request.amount} ${request.currency}. السبب: ${reason}`,
        data: {
          requestId: requestId,
          amount: Number(request.amount),
          currency: request.currency,
          rejectionReason: reason,
        },
      });
      this.logger.log(`Notification created for rejected top-up request ${requestId}`);
    } catch (error: any) {
      // Log error but don't fail - rejection is already processed
      this.logger.warn(`Failed to create notification for rejected top-up request ${requestId}:`, error?.message);
    }

    // Call external API to reject top-up (non-blocking - for notification/audit purposes)
    const baseUrl = process.env.MERCHANT_API_URL;
    if (baseUrl && baseUrl !== 'http://localhost:3002') {
      try {
        const apiUrl = `${baseUrl}/api/merchant/wallet/admin/topup/${requestId}/reject`;
        this.logger.log(`Calling external API to notify rejection: ${apiUrl}`);
        
        await firstValueFrom(
          this.httpService.post(apiUrl, { reason }, {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'X-Tenant-ID': tenantId,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          })
        );
        
        this.logger.log(`External API notified of top-up rejection ${requestId}`);
      } catch (error: any) {
        // Log error but don't fail - rejection is already processed
        this.logger.warn(`Failed to notify external API of top-up rejection ${requestId}:`, error?.response?.data || error?.message);
      }
    }

    return updatedRequest;
  }

  // Get available banks for top-up
  async getBanks(tenantId: string) {
    return this.prisma.bank.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Get all banks (including inactive) for merchant management
  async getAllBanks(tenantId: string) {
    return this.prisma.bank.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Create merchant bank
  async createBank(
    tenantId: string,
    data: {
      name: string;
      nameAr?: string;
      code: string;
      logo?: string;
      accountName: string;
      accountNumber: string;
      iban: string;
      swiftCode?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    // Check if code already exists for this tenant
    const existing = await this.prisma.bank.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: data.code,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Bank with code ${data.code} already exists`);
    }

    return this.prisma.bank.create({
      data: {
        tenantId,
        ...data,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  // Update merchant bank
  async updateBank(
    tenantId: string,
    bankId: string,
    data: {
      name?: string;
      nameAr?: string;
      code?: string;
      logo?: string;
      accountName?: string;
      accountNumber?: string;
      iban?: string;
      swiftCode?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    // Check if bank exists and belongs to tenant
    const bank = await this.prisma.bank.findFirst({
      where: { id: bankId, tenantId },
    });

    if (!bank) {
      throw new NotFoundException('Bank not found');
    }

    // If code is being updated, check for conflicts
    if (data.code && data.code !== bank.code) {
      const existing = await this.prisma.bank.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: data.code,
          },
        },
      });

      if (existing) {
        throw new BadRequestException(`Bank with code ${data.code} already exists`);
      }
    }

    return this.prisma.bank.update({
      where: { id: bankId },
      data,
    });
  }

  // Delete merchant bank
  async deleteBank(tenantId: string, bankId: string) {
    const bank = await this.prisma.bank.findFirst({
      where: { id: bankId, tenantId },
    });

    if (!bank) {
      throw new NotFoundException('Bank not found');
    }

    // Check if bank is being used in any top-up requests
    const topUpCount = await this.prisma.walletTopUpRequest.count({
      where: { bankId },
    });

    if (topUpCount > 0) {
      // Instead of deleting, deactivate it
      return this.prisma.bank.update({
        where: { id: bankId },
        data: { isActive: false },
      });
    }

    return this.prisma.bank.delete({
      where: { id: bankId },
    });
  }

  // Get user's bank accounts
  async getUserBankAccounts(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // Add user bank account
  async addBankAccount(
    userId: string,
    data: {
      bankName: string;
      bankCode?: string;
      accountName: string;
      accountNumber: string;
      iban?: string;
      isDefault?: boolean;
    },
    tenantId?: string,
    userData?: { email?: string; name?: string; role?: string },
  ) {
    // Validate required fields
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    if (!data.bankName || !data.accountName || !data.accountNumber) {
      throw new BadRequestException('Bank name, account name, and account number are required');
    }

    // Ensure user exists in core database (sync from auth if needed)
    const user = await this.userService.ensureUserExists(userId, {
      email: userData?.email || `customer-${userId}@temp.local`,
      name: userData?.name || 'Customer',
      role: userData?.role || 'CUSTOMER',
      tenantId: tenantId || process.env.DEFAULT_TENANT_ID || 'default',
    });
    
    if (!user) {
      this.logger.error(`Failed to create or find user ${userId}`);
      throw new NotFoundException(`User ${userId} not found and could not be created. Cannot create bank account without a valid user.`);
    }

    const actualUserId = user.id;

    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { userId: actualUserId, isDefault: true },
        data: { isDefault: false },
      });
    }

    try {
      return await this.prisma.bankAccount.create({
        data: {
          userId: actualUserId,
          bankName: data.bankName,
          bankCode: data.bankCode || null,
          accountName: data.accountName,
          accountNumber: data.accountNumber,
          iban: data.iban || null,
          isDefault: data.isDefault ?? false,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error creating bank account for user ${userId}:`, error);
      
      // Check for unique constraint violations
      if (error.code === 'P2002') {
        throw new BadRequestException('A bank account with this information already exists');
      }
      
      // Re-throw the original error if it's a known error type
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // For other errors, throw a generic error
      throw new BadRequestException(`Failed to add bank account: ${error.message || 'Unknown error'}`);
    }
  }

  // Delete user bank account
  async deleteBankAccount(accountId: string) {
    try {
      const account = await this.prisma.bankAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException('Bank account not found');
      }

      await this.prisma.bankAccount.delete({
        where: { id: accountId },
      });

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error deleting bank account ${accountId}:`, error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to delete bank account: ${error.message || 'Unknown error'}`);
    }
  }
}

