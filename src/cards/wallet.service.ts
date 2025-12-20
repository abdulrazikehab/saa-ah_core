import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
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

  // Approve top-up request (admin action)
  async approveTopUpRequest(requestId: string, processedByUserId: string) {
    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Top-up request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    // Credit wallet and update request
    const { wallet, transaction } = await this.credit(
      request.userId,
      Number(request.amount),
      `Wallet top-up approved`,
      `تم شحن الرصيد`,
      requestId,
      'TOPUP',
    );

    // Update request status
    const updatedRequest = await this.prisma.walletTopUpRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        processedAt: new Date(),
        processedByUserId,
      },
    });

    // Link transaction to top-up request
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: { topUpRequestId: requestId },
    });

    this.logger.log(`Approved top-up request ${requestId}`);

    return { request: updatedRequest, wallet };
  }

  // Reject top-up request (admin action)
  async rejectTopUpRequest(requestId: string, processedByUserId: string, reason: string) {
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

