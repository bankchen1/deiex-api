import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import {
  Wallet,
  WalletStatus,
  WalletTransaction,
  TransactionType,
  TransactionStatus,
  ChainConfig,
  CurrencyConfig,
  WithdrawalLimit,
  AddressWhitelist,
} from '../types/wallet.types';
import { ethers } from 'ethers';
import { Web3Service } from './web3.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly WALLET_PREFIX = 'wallet:';
  private readonly CACHE_TTL = 3600; // 1小时缓存
  private readonly currencyConfigs: Map<string, CurrencyConfig> = new Map();
  private readonly chainConfigs: Map<string, ChainConfig> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly web3Service: Web3Service,
  ) {
    this.initializeConfigs();
  }

  private async initializeConfigs() {
    // 从配置文件或数据库加载币种和链的配置
    const currencies = await this.prisma.currencyConfig.findMany();
    const chains = await this.prisma.chainConfig.findMany();

    for (const currency of currencies) {
      this.currencyConfigs.set(currency.symbol, currency);
    }

    for (const chain of chains) {
      this.chainConfigs.set(chain.chainId, chain);
    }
  }

  // 钱包创建和管理
  async createWallet(
    userId: string,
    currency: string,
  ): Promise<Wallet> {
    const startTime = Date.now();
    try {
      // 检查币种配置
      const currencyConfig = this.currencyConfigs.get(currency);
      if (!currencyConfig || !currencyConfig.enabled) {
        throw new Error(`Currency ${currency} is not supported`);
      }

      // 检查是否已存在钱包
      const existingWallet = await this.prisma.wallet.findFirst({
        where: { userId, currency },
      });

      if (existingWallet) {
        throw new Error(`Wallet for ${currency} already exists`);
      }

      // 生成钱包地址
      const address = await this.generateWalletAddress(currency);

      // 创建钱包
      const wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currency,
          address,
          balance: 0,
          frozenBalance: 0,
          totalDeposit: 0,
          totalWithdraw: 0,
          status: WalletStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 创建审计日志
      await this.createAuditLog(wallet.id, userId, 'CREATE', {}, 'Initial wallet creation');

      // 清除缓存
      await this.redis.del(`${this.WALLET_PREFIX}${userId}:${currency}`);

      // 发送钱包创建事件
      this.eventEmitter.emit('wallet.created', {
        userId,
        currency,
        address,
      });

      // 记录性能指标
      this.prometheusService.recordLatency('create_wallet', Date.now() - startTime);

      return wallet;
    } catch (error) {
      this.logger.error(`Failed to create wallet: ${error.message}`);
      this.prometheusService.incrementErrors('create_wallet_error');
      throw error;
    }
  }

  private async generateWalletAddress(currency: string): Promise<string> {
    const currencyConfig = this.currencyConfigs.get(currency);
    if (!currencyConfig) {
      throw new Error(`Currency ${currency} not configured`);
    }

    // 对于每个支持的链，生成或获取地址
    const addresses = await Promise.all(
      currencyConfig.chains.map(async (chainId) => {
        const chainConfig = this.chainConfigs.get(chainId);
        if (!chainConfig) {
          throw new Error(`Chain ${chainId} not configured`);
        }

        return this.web3Service.generateAddress(chainId);
      })
    );

    // 返回主链地址
    return addresses[0];
  }

  // 余额操作
  async updateBalance(
    walletId: string,
    amount: number,
    type: TransactionType,
    metadata?: any,
  ): Promise<Wallet> {
    return await this.prisma.$transaction(async (prisma) => {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.status !== WalletStatus.ACTIVE) {
        throw new Error('Wallet is not active');
      }

      // 检查余额是否足够（如果是扣款）
      if (amount < 0 && wallet.balance + amount < 0) {
        throw new Error('Insufficient balance');
      }

      // 更新余额
      const updatedWallet = await prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            increment: amount,
          },
          updatedAt: new Date(),
        },
      });

      // 创建交易记录
      await prisma.walletTransaction.create({
        data: {
          walletId,
          userId: wallet.userId,
          currency: wallet.currency,
          type,
          amount: Math.abs(amount),
          fee: 0,
          status: TransactionStatus.COMPLETED,
          memo: metadata?.memo,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 清除缓存
      await this.redis.del(`${this.WALLET_PREFIX}${wallet.userId}:${wallet.currency}`);

      // 发送余额更新事件
      this.eventEmitter.emit('wallet.balance.updated', {
        userId: wallet.userId,
        currency: wallet.currency,
        amount,
        type,
        balance: updatedWallet.balance,
      });

      return updatedWallet;
    });
  }

  async freezeBalance(
    walletId: string,
    amount: number,
  ): Promise<Wallet> {
    return await this.prisma.$transaction(async (prisma) => {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.balance < amount) {
        throw new Error('Insufficient balance to freeze');
      }

      return await prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            decrement: amount,
          },
          frozenBalance: {
            increment: amount,
          },
          updatedAt: new Date(),
        },
      });
    });
  }

  async unfreezeBalance(
    walletId: string,
    amount: number,
  ): Promise<Wallet> {
    return await this.prisma.$transaction(async (prisma) => {
      const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.frozenBalance < amount) {
        throw new Error('Insufficient frozen balance');
      }

      return await prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            increment: amount,
          },
          frozenBalance: {
            decrement: amount,
          },
          updatedAt: new Date(),
        },
      });
    });
  }

  // 地址白名单管理
  async addWhitelistAddress(
    userId: string,
    currency: string,
    chain: string,
    address: string,
    label: string,
  ): Promise<AddressWhitelist> {
    // 验证地址格式
    if (!this.web3Service.isValidAddress(chain, address)) {
      throw new Error('Invalid address format');
    }

    // 检查是否已存在
    const existing = await this.prisma.addressWhitelist.findFirst({
      where: {
        userId,
        currency,
        chain,
        address,
      },
    });

    if (existing) {
      throw new Error('Address already in whitelist');
    }

    // 添加到白名单
    return await this.prisma.addressWhitelist.create({
      data: {
        userId,
        currency,
        chain,
        address,
        label,
        enabled: true,
        createdAt: new Date(),
      },
    });
  }

  // 提现限额管理
  async checkAndUpdateWithdrawalLimit(
    userId: string,
    currency: string,
    amount: number,
  ): Promise<boolean> {
    return await this.prisma.$transaction(async (prisma) => {
      let limit = await prisma.withdrawalLimit.findUnique({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
      });

      if (!limit) {
        // 创建新的限额记录
        limit = await prisma.withdrawalLimit.create({
          data: {
            userId,
            currency,
            dailyLimit: this.configService.get(`WITHDRAWAL_DAILY_LIMIT_${currency}`, 10000),
            dailyUsed: 0,
            monthlyLimit: this.configService.get(`WITHDRAWAL_MONTHLY_LIMIT_${currency}`, 100000),
            monthlyUsed: 0,
            lastResetDaily: new Date(),
            lastResetMonthly: new Date(),
          },
        });
      }

      // 检查是否需要重置每日限额
      if (this.shouldResetDaily(limit.lastResetDaily)) {
        limit.dailyUsed = 0;
        limit.lastResetDaily = new Date();
      }

      // 检查是否需要重置每月限额
      if (this.shouldResetMonthly(limit.lastResetMonthly)) {
        limit.monthlyUsed = 0;
        limit.lastResetMonthly = new Date();
      }

      // 检查限额
      if (limit.dailyUsed + amount > limit.dailyLimit) {
        throw new Error('Daily withdrawal limit exceeded');
      }

      if (limit.monthlyUsed + amount > limit.monthlyLimit) {
        throw new Error('Monthly withdrawal limit exceeded');
      }

      // 更新使用量
      await prisma.withdrawalLimit.update({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
        data: {
          dailyUsed: limit.dailyUsed + amount,
          monthlyUsed: limit.monthlyUsed + amount,
          lastResetDaily: limit.lastResetDaily,
          lastResetMonthly: limit.lastResetMonthly,
        },
      });

      return true;
    });
  }

  private shouldResetDaily(lastReset: Date): boolean {
    const now = new Date();
    return (
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCDate() !== lastReset.getUTCDate()
    );
  }

  private shouldResetMonthly(lastReset: Date): boolean {
    const now = new Date();
    return (
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth()
    );
  }

  // 审计日志
  private async createAuditLog(
    walletId: string,
    userId: string,
    action: string,
    changes: Record<string, any>,
    reason?: string,
  ) {
    await this.prisma.walletAuditLog.create({
      data: {
        walletId,
        userId,
        action,
        changes,
        reason,
        operator: 'SYSTEM',
        ipAddress: '0.0.0.0',
        createdAt: new Date(),
      },
    });
  }

  // 公共API方法
  async getWallet(userId: string, currency: string): Promise<Wallet> {
    const cacheKey = `${this.WALLET_PREFIX}${userId}:${currency}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency },
    });

    if (wallet) {
      await this.redis.set(cacheKey, JSON.stringify(wallet), 'EX', this.CACHE_TTL);
    }

    return wallet;
  }

  async getUserWallets(userId: string): Promise<Wallet[]> {
    return await this.prisma.wallet.findMany({
      where: { userId },
    });
  }

  async getTransactionHistory(
    userId: string,
    currency?: string,
    type?: TransactionType,
    startTime?: Date,
    endTime?: Date,
    page: number = 1,
    limit: number = 20,
  ): Promise<WalletTransaction[]> {
    return await this.prisma.walletTransaction.findMany({
      where: {
        userId,
        currency,
        type,
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getWhitelistAddresses(
    userId: string,
    currency?: string,
  ): Promise<AddressWhitelist[]> {
    return await this.prisma.addressWhitelist.findMany({
      where: {
        userId,
        currency,
        enabled: true,
      },
    });
  }

  async getWithdrawalLimits(
    userId: string,
    currency: string,
  ): Promise<WithdrawalLimit> {
    return await this.prisma.withdrawalLimit.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });
  }
}
