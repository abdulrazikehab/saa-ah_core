import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private httpService: HttpService,
  ) {}

  // Get or create wallet for user
  async getOrCreateWallet(tenantId: string, userId: string, userData?: { email?: string; name?: string; role?: string }) {
    // First, ensure user exists in core database
    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user && userData?.email) {
      this.logger.log(`User ${userId} not found in core database, syncing from auth...`);
      try {
        user = await this.userService.ensureUserExists(userId, {
          email: userData.email,
          name: userData.name,
          role: userData.role || 'SHOP_OWNER',
          tenantId: tenantId,
        });
      } catch (error) {
        this.logger.error(`Failed to ensure user exists: ${error}`);
        throw new NotFoundException(`User ${userId} not found. Please ensure user is synced from auth service.`);
      }
    } else if (!user) {
      throw new NotFoundException(`User ${userId} not found. Please ensure user is synced from auth service.`);
    }

    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          tenantId,
          userId,
          balance: 0,
          currency: 'SAR',
        },
      });
      this.logger.log(`Created new wallet for user ${userId}`);
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
    // Ensure wallet exists (and user exists)
    await this.getOrCreateWallet(tenantId, userId, userData);

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
        userId,
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

    this.logger.log(`Created top-up request ${request.id} for user ${userId}`);

    return request;
  }

  // Get pending top-up requests for user
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
  ) {
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.bankAccount.create({
      data: {
        userId,
        ...data,
      },
    });
  }
}

