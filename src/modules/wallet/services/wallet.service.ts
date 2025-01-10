import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { TransactionType, TransactionStatus, CurrencyConfig, ChainConfig } from '../types/wallet.types';

@Injectable()
export class WalletService {
  private readonly currencyConfigs: Map<string, CurrencyConfig> = new Map();
  private readonly chainConfigs: Map<string, ChainConfig> = new Map();

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.loadConfigs();
  }

  private async loadConfigs() {
    const currencies = await this.prisma.currencyConfig.findMany();
    const chains = await this.prisma.chainConfig.findMany();

    for (const currency of currencies) {
      this.currencyConfigs.set(currency.symbol, {
        ...currency,
        withdrawFee: currency.withdrawFee,
        minWithdraw: currency.minWithdraw,
      });
    }

    for (const chain of chains) {
      this.chainConfigs.set(chain.chain, {
        ...chain,
      });
    }
  }

  async getBalance(userId: string, currency: string) {
    const balance = await this.prisma.balance.findFirst({
      where: {
        userId,
        currency,
      },
    });

    if (!balance) {
      return {
        available: '0',
        locked: '0',
      };
    }

    return {
      available: balance.available,
      locked: balance.locked,
    };
  }

  async createTransaction(dto: {
    userId: string;
    type: TransactionType;
    amount: string;
    currency: string;
    status?: TransactionStatus;
    fee?: string;
    txHash?: string;
    address?: string;
    chain?: string;
  }) {
    return await this.prisma.walletTransaction.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        currency: dto.currency,
        status: dto.status || TransactionStatus.PENDING,
        fee: dto.fee || '0',
        txHash: dto.txHash,
        address: dto.address,
        chain: dto.chain,
      },
    });
  }

  async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    error?: Error
  ) {
    const data: any = { status };
    if (error) {
      data.additionalData = { error: error.message };
    }

    return await this.prisma.walletTransaction.update({
      where: { id },
      data,
    });
  }

  async freezeBalance(userId: string, currency: string, amount: string) {
    const balance = await this.prisma.balance.findFirst({
      where: {
        userId,
        currency,
      },
    });

    if (!balance) {
      throw new Error('Insufficient balance');
    }

    const available = BigInt(balance.available);
    const amountBigInt = BigInt(amount);

    if (available < amountBigInt) {
      throw new Error('Insufficient balance');
    }

    return await this.prisma.balance.update({
      where: {
        id: balance.id,
      },
      data: {
        available: (available - amountBigInt).toString(),
        locked: (BigInt(balance.locked) + amountBigInt).toString(),
      },
    });
  }

  async unfreezeBalance(userId: string, currency: string, amount: string) {
    const balance = await this.prisma.balance.findFirst({
      where: {
        userId,
        currency,
      },
    });

    if (!balance) {
      throw new Error('Balance not found');
    }

    const locked = BigInt(balance.locked);
    const amountBigInt = BigInt(amount);

    if (locked < amountBigInt) {
      throw new Error('Insufficient locked balance');
    }

    return await this.prisma.balance.update({
      where: {
        id: balance.id,
      },
      data: {
        available: (BigInt(balance.available) + amountBigInt).toString(),
        locked: (locked - amountBigInt).toString(),
      },
    });
  }

  async createAuditLog(data: {
    userId: string;
    walletId: string;
    action: string;
    changes: Record<string, any>;
    reason?: string;
    operator: string;
    ipAddress: string;
  }) {
    return await this.prisma.$queryRaw`
      INSERT INTO "WalletAuditLog" (
        "id",
        "userId",
        "walletId",
        "action",
        "changes",
        "reason",
        "operator",
        "ipAddress",
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        ${data.userId},
        ${data.walletId},
        ${data.action},
        ${data.changes}::jsonb,
        ${data.reason},
        ${data.operator},
        ${data.ipAddress},
        NOW(),
        NOW()
      ) RETURNING *
    `;
  }

  async getTransactions(userId: string, currency?: string) {
    return await this.prisma.walletTransaction.findMany({
      where: {
        userId,
        ...(currency ? { currency } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getWithdrawalLimits(userId: string, currency: string) {
    const limit = await this.prisma.withdrawalLimit.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });

    if (!limit) {
      const dailyLimit = this.configService.get(`WITHDRAWAL_DAILY_LIMIT_${currency}`, '10000');
      const monthlyLimitValue = (BigInt(dailyLimit) * BigInt(30)).toString();
      
      return await this.prisma.$queryRaw`
        INSERT INTO "WithdrawalLimit" (
          "id",
          "userId",
          "currency",
          "dailyLimit",
          "dailyUsed",
          "monthlyLimit",
          "monthlyUsed",
          "lastResetDaily",
          "lastResetMonthly",
          "createdAt",
          "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${userId},
          ${currency},
          ${dailyLimit},
          '0',
          ${monthlyLimitValue},
          '0',
          NOW(),
          NOW(),
          NOW(),
          NOW()
        ) RETURNING *
      `;
    }

    return limit;
  }
}
