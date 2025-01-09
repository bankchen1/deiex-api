import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { WalletService } from './wallet.service';
import { Web3Service } from './web3.service';
import { 
  WalletTransaction,
  TransactionType,
  TransactionStatus,
  ChainConfig,
  CurrencyConfig,
  WithdrawalLimit,
} from '../types/wallet.types';
import { Cron } from '@nestjs/schedule';

interface WithdrawalRequest {
  userId: string;
  currency: string;
  chain: string;
  amount: number;
  toAddress: string;
  memo?: string;
}

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);
  private readonly WITHDRAWAL_LOCK_KEY = 'withdrawal:lock:';
  private readonly WITHDRAWAL_LOCK_TTL = 300; // 5分钟
  private readonly currencyConfigs: Map<string, CurrencyConfig> = new Map();
  private readonly chainConfigs: Map<string, ChainConfig> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly walletService: WalletService,
    private readonly web3Service: Web3Service,
  ) {
    this.initializeConfigs();
  }

  private async initializeConfigs() {
    // 加载币种和链的配置
    const currencies = await this.prisma.currencyConfig.findMany();
    const chains = await this.prisma.chainConfig.findMany();

    for (const currency of currencies) {
      this.currencyConfigs.set(currency.symbol, currency);
    }

    for (const chain of chains) {
      this.chainConfigs.set(chain.chainId, chain);
    }
  }

  // 创建提现请求
  async createWithdrawal(request: WithdrawalRequest): Promise<WalletTransaction> {
    const startTime = Date.now();
    try {
      // 验证币种配置
      const currencyConfig = this.currencyConfigs.get(request.currency);
      if (!currencyConfig || !currencyConfig.enabled) {
        throw new Error(`Currency ${request.currency} is not supported`);
      }

      // 验证链配置
      if (!currencyConfig.chains.includes(request.chain)) {
        throw new Error(`Chain ${request.chain} is not supported for ${request.currency}`);
      }

      // 验证地址格式
      if (!this.web3Service.isValidAddress(request.chain, request.toAddress)) {
        throw new Error('Invalid withdrawal address');
      }

      // 验证提现金额
      if (request.amount <= 0) {
        throw new Error('Invalid withdrawal amount');
      }

      if (request.amount < currencyConfig.minWithdrawal) {
        throw new Error(`Withdrawal amount must be at least ${currencyConfig.minWithdrawal}`);
      }

      if (request.amount > currencyConfig.maxWithdrawal) {
        throw new Error(`Withdrawal amount cannot exceed ${currencyConfig.maxWithdrawal}`);
      }

      // 检查地址白名单
      const isWhitelisted = await this.checkAddressWhitelist(
        request.userId,
        request.currency,
        request.chain,
        request.toAddress
      );

      if (!isWhitelisted) {
        throw new Error('Address not in whitelist');
      }

      // 检查提现限额
      await this.walletService.checkAndUpdateWithdrawalLimit(
        request.userId,
        request.currency,
        request.amount
      );

      // 获取钱包
      const wallet = await this.walletService.getWallet(request.userId, request.currency);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // 计算手续费
      const fee = this.calculateWithdrawalFee(request.amount, currencyConfig);
      const totalAmount = request.amount + fee;

      // 冻结余额
      await this.walletService.freezeBalance(wallet.id, totalAmount);

      // 创建提现记录
      const withdrawal = await this.prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: request.userId,
          currency: request.currency,
          type: TransactionType.WITHDRAW,
          amount: request.amount,
          fee,
          status: TransactionStatus.PENDING,
          toAddress: request.toAddress,
          memo: request.memo,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 发送提现请求事件
      this.eventEmitter.emit('wallet.withdrawal.created', {
        userId: request.userId,
        currency: request.currency,
        amount: request.amount,
        fee,
        withdrawal,
      });

      // 记录性能指标
      this.prometheusService.recordLatency('create_withdrawal', Date.now() - startTime);

      return withdrawal;
    } catch (error) {
      this.logger.error(`Failed to create withdrawal: ${error.message}`);
      this.prometheusService.incrementErrors('create_withdrawal_error');
      throw error;
    }
  }

  private calculateWithdrawalFee(amount: number, currencyConfig: CurrencyConfig): number {
    return amount * currencyConfig.withdrawalFee;
  }

  private async checkAddressWhitelist(
    userId: string,
    currency: string,
    chain: string,
    address: string,
  ): Promise<boolean> {
    const whitelist = await this.prisma.addressWhitelist.findFirst({
      where: {
        userId,
        currency,
        chain,
        address,
        enabled: true,
      },
    });

    return !!whitelist;
  }

  // 处理待处理的提现
  @Cron('*/1 * * * *')
  async processPendingWithdrawals() {
    const startTime = Date.now();
    try {
      // 获取待处理的提现
      const pendingWithdrawals = await this.prisma.walletTransaction.findMany({
        where: {
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PENDING,
        },
        orderBy: { createdAt: 'asc' },
        take: 10, // 每次处理10条
      });

      // 并行处理提现
      await Promise.all(
        pendingWithdrawals.map(withdrawal => this.processWithdrawal(withdrawal))
      );

      // 记录性能指标
      this.prometheusService.recordLatency('process_withdrawals', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to process withdrawals: ${error.message}`);
      this.prometheusService.incrementErrors('process_withdrawals_error');
    }
  }

  private async processWithdrawal(withdrawal: WalletTransaction) {
    const lockKey = `${this.WITHDRAWAL_LOCK_KEY}${withdrawal.id}`;
    const locked = await this.redis.set(lockKey, '1', 'NX', 'EX', this.WITHDRAWAL_LOCK_TTL);
    
    if (!locked) {
      return; // 另一个进程正在处理
    }

    try {
      // 获取钱包
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: withdrawal.walletId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // 发送链上交易
      const txHash = await this.web3Service.sendWithdrawal({
        currency: withdrawal.currency,
        toAddress: withdrawal.toAddress,
        amount: withdrawal.amount,
        memo: withdrawal.memo,
      });

      // 更新提现状态
      await this.prisma.walletTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: TransactionStatus.PROCESSING,
          txHash,
          updatedAt: new Date(),
        },
      });

      // 发送提现处理事件
      this.eventEmitter.emit('wallet.withdrawal.processing', {
        userId: withdrawal.userId,
        currency: withdrawal.currency,
        amount: withdrawal.amount,
        txHash,
        withdrawal,
      });

    } catch (error) {
      this.logger.error(
        `Failed to process withdrawal ${withdrawal.id}: ${error.message}`
      );

      // 更新提现状态为失败
      await this.prisma.walletTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: TransactionStatus.FAILED,
          updatedAt: new Date(),
        },
      });

      // 解冻余额
      await this.walletService.unfreezeBalance(
        withdrawal.walletId,
        withdrawal.amount + withdrawal.fee
      );

      // 发送提现失败事件
      this.eventEmitter.emit('wallet.withdrawal.failed', {
        userId: withdrawal.userId,
        currency: withdrawal.currency,
        amount: withdrawal.amount,
        error: error.message,
        withdrawal,
      });

    } finally {
      // 释放锁
      await this.redis.del(lockKey);
    }
  }

  // 更新处理中的提现状态
  @Cron('*/5 * * * *')
  async updateProcessingWithdrawals() {
    const startTime = Date.now();
    try {
      // 获取处理中的提现
      const processingWithdrawals = await this.prisma.walletTransaction.findMany({
        where: {
          type: TransactionType.WITHDRAW,
          status: TransactionStatus.PROCESSING,
        },
      });

      for (const withdrawal of processingWithdrawals) {
        await this.updateWithdrawalStatus(withdrawal);
      }

      // 记录性能指标
      this.prometheusService.recordLatency('update_withdrawals', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to update withdrawals: ${error.message}`);
      this.prometheusService.incrementErrors('update_withdrawals_error');
    }
  }

  private async updateWithdrawalStatus(withdrawal: WalletTransaction) {
    try {
      // 获取交易确认数
      const confirmations = await this.web3Service.getTransactionConfirmations(
        withdrawal.currency,
        withdrawal.txHash
      );

      // 获取币种配置
      const currencyConfig = this.currencyConfigs.get(withdrawal.currency);
      if (!currencyConfig) {
        throw new Error(`Currency config not found for ${withdrawal.currency}`);
      }

      // 更新确认数
      await this.prisma.walletTransaction.update({
        where: { id: withdrawal.id },
        data: {
          confirmations,
          updatedAt: new Date(),
        },
      });

      // 如果确认数足够，完成提现
      if (confirmations >= currencyConfig.confirmations) {
        await this.completeWithdrawal(withdrawal);
      }

    } catch (error) {
      this.logger.error(
        `Failed to update withdrawal status for ${withdrawal.id}: ${error.message}`
      );

      // 如果交易失败，回滚提现
      if (error.message.includes('Transaction failed')) {
        await this.rollbackWithdrawal(withdrawal);
      }
    }
  }

  private async completeWithdrawal(withdrawal: WalletTransaction) {
    await this.prisma.$transaction(async (prisma) => {
      // 更新提现状态
      await prisma.walletTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: TransactionStatus.COMPLETED,
          updatedAt: new Date(),
        },
      });

      // 扣除冻结余额
      await this.walletService.unfreezeBalance(
        withdrawal.walletId,
        withdrawal.amount + withdrawal.fee
      );

      // 更新总提现金额
      await prisma.wallet.update({
        where: { id: withdrawal.walletId },
        data: {
          totalWithdraw: {
            increment: withdrawal.amount,
          },
        },
      });

      // 发送提现完成事件
      this.eventEmitter.emit('wallet.withdrawal.completed', {
        userId: withdrawal.userId,
        currency: withdrawal.currency,
        amount: withdrawal.amount,
        txHash: withdrawal.txHash,
        withdrawal,
      });
    });
  }

  private async rollbackWithdrawal(withdrawal: WalletTransaction) {
    await this.prisma.$transaction(async (prisma) => {
      // 更新提现状态
      await prisma.walletTransaction.update({
        where: { id: withdrawal.id },
        data: {
          status: TransactionStatus.FAILED,
          updatedAt: new Date(),
        },
      });

      // 解冻余额
      await this.walletService.unfreezeBalance(
        withdrawal.walletId,
        withdrawal.amount + withdrawal.fee
      );

      // 发送提现失败事件
      this.eventEmitter.emit('wallet.withdrawal.failed', {
        userId: withdrawal.userId,
        currency: withdrawal.currency,
        amount: withdrawal.amount,
        error: 'Transaction failed on chain',
        withdrawal,
      });
    });
  }

  // 公共API方法
  async getWithdrawalHistory(
    userId: string,
    currency?: string,
    status?: TransactionStatus,
    startTime?: Date,
    endTime?: Date,
    page: number = 1,
    limit: number = 20,
  ): Promise<WalletTransaction[]> {
    return await this.prisma.walletTransaction.findMany({
      where: {
        userId,
        currency,
        type: TransactionType.WITHDRAW,
        status,
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

  async getWithdrawalFee(
    currency: string,
    amount: number,
  ): Promise<number> {
    const currencyConfig = this.currencyConfigs.get(currency);
    if (!currencyConfig) {
      throw new Error(`Currency ${currency} not supported`);
    }
    return this.calculateWithdrawalFee(amount, currencyConfig);
  }

  async getWithdrawalLimits(
    userId: string,
    currency: string,
  ): Promise<WithdrawalLimit> {
    return await this.walletService.getWithdrawalLimits(userId, currency);
  }
}
