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
} from '../types/wallet.types';
import { Cron } from '@nestjs/schedule';

interface DepositInfo {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: string;
  chain: string;
  confirmations: number;
  blockNumber: number;
  timestamp: number;
}

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);
  private readonly DEPOSIT_SCAN_KEY = 'deposit:scan:';
  private readonly DEPOSIT_LOCK_TTL = 60; // 60 seconds
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

  // 每分钟扫描新的充值
  @Cron('*/1 * * * *')
  async scanNewDeposits() {
    const startTime = Date.now();
    try {
      // 获取所有支持的链
      const chains = Array.from(this.chainConfigs.keys());

      // 并行扫描每条链
      await Promise.all(
        chains.map(chainId => this.scanChainDeposits(chainId))
      );

      // 记录性能指标
      this.prometheusService.recordLatency('scan_deposits', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to scan deposits: ${error.message}`);
      this.prometheusService.incrementErrors('scan_deposits_error');
    }
  }

  private async scanChainDeposits(chainId: string) {
    const lockKey = `${this.DEPOSIT_SCAN_KEY}${chainId}`;
    const locked = await this.redis.set(lockKey, '1', 'NX', 'EX', this.DEPOSIT_LOCK_TTL);
    
    if (!locked) {
      return; // 另一个进程正在扫描
    }

    try {
      // 获取上次扫描的区块
      const lastScannedBlock = await this.getLastScannedBlock(chainId);
      
      // 获取当前区块
      const currentBlock = await this.web3Service.getCurrentBlockNumber(chainId);
      
      // 计算需要扫描的区块范围
      const fromBlock = lastScannedBlock + 1;
      const toBlock = Math.min(currentBlock, fromBlock + 100); // 每次最多扫描100个区块

      // 获取系统所有充值地址
      const depositAddresses = await this.getSystemDepositAddresses(chainId);

      // 扫描区块
      const deposits = await this.web3Service.scanBlocksForDeposits(
        chainId,
        fromBlock,
        toBlock,
        depositAddresses
      );

      // 处理找到的充值
      for (const deposit of deposits) {
        await this.processDeposit(deposit);
      }

      // 更新最后扫描的区块
      await this.updateLastScannedBlock(chainId, toBlock);

    } finally {
      // 释放锁
      await this.redis.del(lockKey);
    }
  }

  private async getLastScannedBlock(chainId: string): Promise<number> {
    const block = await this.prisma.chainScanStatus.findUnique({
      where: { chainId },
    });

    if (!block) {
      // 如果没有记录，从当前区块开始扫描
      const currentBlock = await this.web3Service.getCurrentBlockNumber(chainId);
      await this.prisma.chainScanStatus.create({
        data: {
          chainId,
          lastScannedBlock: currentBlock,
          updatedAt: new Date(),
        },
      });
      return currentBlock;
    }

    return block.lastScannedBlock;
  }

  private async updateLastScannedBlock(chainId: string, blockNumber: number) {
    await this.prisma.chainScanStatus.update({
      where: { chainId },
      data: {
        lastScannedBlock: blockNumber,
        updatedAt: new Date(),
      },
    });
  }

  private async getSystemDepositAddresses(chainId: string): Promise<Set<string>> {
    const wallets = await this.prisma.wallet.findMany({
      select: { address: true },
    });

    return new Set(wallets.map(w => w.address.toLowerCase()));
  }

  private async processDeposit(deposit: DepositInfo): Promise<void> {
    const startTime = Date.now();
    try {
      // 检查交易是否已处理
      const existingTx = await this.prisma.walletTransaction.findFirst({
        where: {
          txHash: deposit.txHash,
          type: TransactionType.DEPOSIT,
        },
      });

      if (existingTx) {
        return; // 交易已处理
      }

      // 查找钱包
      const wallet = await this.prisma.wallet.findFirst({
        where: {
          address: deposit.toAddress,
          currency: deposit.currency,
        },
      });

      if (!wallet) {
        this.logger.error(`Wallet not found for address ${deposit.toAddress}`);
        return;
      }

      // 检查确认数
      const currencyConfig = this.currencyConfigs.get(deposit.currency);
      if (!currencyConfig) {
        throw new Error(`Currency config not found for ${deposit.currency}`);
      }

      const status = deposit.confirmations >= currencyConfig.confirmations
        ? TransactionStatus.COMPLETED
        : TransactionStatus.PROCESSING;

      // 创建充值记录
      await this.prisma.$transaction(async (prisma) => {
        const transaction = await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: wallet.userId,
            currency: deposit.currency,
            type: TransactionType.DEPOSIT,
            amount: deposit.amount,
            fee: 0,
            status,
            txHash: deposit.txHash,
            confirmations: deposit.confirmations,
            fromAddress: deposit.fromAddress,
            toAddress: deposit.toAddress,
            createdAt: new Date(deposit.timestamp * 1000),
            updatedAt: new Date(),
          },
        });

        // 如果确认数足够，更新钱包余额
        if (status === TransactionStatus.COMPLETED) {
          await this.walletService.updateBalance(
            wallet.id,
            deposit.amount,
            TransactionType.DEPOSIT,
            { txHash: deposit.txHash }
          );

          // 更新总充值金额
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              totalDeposit: {
                increment: deposit.amount,
              },
            },
          });
        }

        // 发送充值事件
        this.eventEmitter.emit('wallet.deposit', {
          userId: wallet.userId,
          currency: deposit.currency,
          amount: deposit.amount,
          status,
          transaction,
        });
      });

      // 记录性能指标
      this.prometheusService.recordLatency('process_deposit', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to process deposit: ${error.message}`);
      this.prometheusService.incrementErrors('process_deposit_error');
      throw error;
    }
  }

  // 更新待处理充值的确认数
  @Cron('*/5 * * * *')
  async updatePendingDeposits() {
    const startTime = Date.now();
    try {
      // 获取所有待处理的充值
      const pendingDeposits = await this.prisma.walletTransaction.findMany({
        where: {
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PROCESSING,
        },
      });

      for (const deposit of pendingDeposits) {
        await this.updateDepositConfirmations(deposit);
      }

      // 记录性能指标
      this.prometheusService.recordLatency('update_pending_deposits', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to update pending deposits: ${error.message}`);
      this.prometheusService.incrementErrors('update_pending_deposits_error');
    }
  }

  private async updateDepositConfirmations(deposit: WalletTransaction) {
    try {
      // 获取交易确认数
      const confirmations = await this.web3Service.getTransactionConfirmations(
        deposit.currency,
        deposit.txHash
      );

      // 获取币种配置
      const currencyConfig = this.currencyConfigs.get(deposit.currency);
      if (!currencyConfig) {
        throw new Error(`Currency config not found for ${deposit.currency}`);
      }

      // 更新确认数
      await this.prisma.$transaction(async (prisma) => {
        await prisma.walletTransaction.update({
          where: { id: deposit.id },
          data: {
            confirmations,
            updatedAt: new Date(),
          },
        });

        // 如果确认数足够，完成充值
        if (confirmations >= currencyConfig.confirmations) {
          await prisma.walletTransaction.update({
            where: { id: deposit.id },
            data: {
              status: TransactionStatus.COMPLETED,
              updatedAt: new Date(),
            },
          });

          // 更新钱包余额
          await this.walletService.updateBalance(
            deposit.walletId,
            deposit.amount,
            TransactionType.DEPOSIT,
            { txHash: deposit.txHash }
          );

          // 更新总充值金额
          await prisma.wallet.update({
            where: { id: deposit.walletId },
            data: {
              totalDeposit: {
                increment: deposit.amount,
              },
            },
          });

          // 发送充值完成事件
          this.eventEmitter.emit('wallet.deposit.completed', {
            userId: deposit.userId,
            currency: deposit.currency,
            amount: deposit.amount,
            transaction: deposit,
          });
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to update deposit confirmations for tx ${deposit.txHash}: ${error.message}`
      );
      throw error;
    }
  }

  // 公共API方法
  async getDepositAddress(
    userId: string,
    currency: string,
    chain: string,
  ): Promise<string> {
    // 获取或创建钱包
    let wallet = await this.walletService.getWallet(userId, currency);
    if (!wallet) {
      wallet = await this.walletService.createWallet(userId, currency);
    }

    // 对于不同的链，可能需要不同的地址
    const address = await this.web3Service.getDepositAddress(chain, wallet.address);
    return address;
  }

  async getDepositHistory(
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
        type: TransactionType.DEPOSIT,
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

  async getMinimumDepositAmount(currency: string): Promise<number> {
    const config = this.currencyConfigs.get(currency);
    if (!config) {
      throw new Error(`Currency ${currency} not supported`);
    }
    return config.minWithdrawal; // 使用最小提现额作为最小充值额
  }
}
