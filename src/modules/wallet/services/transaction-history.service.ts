import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { 
  WalletTransaction,
  TransactionType,
  TransactionStatus,
} from '../types/wallet.types';

interface TransactionSummary {
  totalCount: number;
  totalAmount: number;
  totalFee: number;
}

interface DailyTransactionStats {
  date: string;
  count: number;
  amount: number;
  fee: number;
}

@Injectable()
export class TransactionHistoryService {
  private readonly logger = new Logger(TransactionHistoryService.name);
  private readonly CACHE_PREFIX = 'tx:history:';
  private readonly CACHE_TTL = 300; // 5分钟缓存

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // 监听所有交易相关事件
    this.eventEmitter.on('wallet.deposit', (data) => this.invalidateCache(data.userId));
    this.eventEmitter.on('wallet.withdrawal.completed', (data) => this.invalidateCache(data.userId));
    this.eventEmitter.on('wallet.transfer', (data) => this.invalidateCache(data.userId));
  }

  private async invalidateCache(userId: string) {
    const keys = await this.redis.keys(`${this.CACHE_PREFIX}${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // 获取交易历史
  async getTransactionHistory(
    userId: string,
    options: {
      currency?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      startTime?: Date;
      endTime?: Date;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    transactions: WalletTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const startTime = Date.now();
    try {
      const {
        currency,
        type,
        status,
        startTime: start,
        endTime: end,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      // 构建缓存键
      const cacheKey = this.buildCacheKey(userId, options);
      
      // 尝试从缓存获取
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // 查询条件
      const where = {
        userId,
        ...(currency && { currency }),
        ...(type && { type }),
        ...(status && { status }),
        ...(start && end && {
          createdAt: {
            gte: start,
            lte: end,
          },
        }),
      };

      // 查询总数
      const total = await this.prisma.walletTransaction.count({ where });

      // 查询交易
      const transactions = await this.prisma.walletTransaction.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      });

      const result = {
        transactions,
        total,
        page,
        limit,
      };

      // 缓存结果
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        this.CACHE_TTL
      );

      // 记录性能指标
      this.prometheusService.recordLatency('get_transaction_history', Date.now() - startTime);

      return result;
    } catch (error) {
      this.logger.error(`Failed to get transaction history: ${error.message}`);
      this.prometheusService.incrementErrors('get_transaction_history_error');
      throw error;
    }
  }

  private buildCacheKey(userId: string, options: any): string {
    const {
      currency,
      type,
      status,
      startTime,
      endTime,
      page,
      limit,
      sortBy,
      sortOrder,
    } = options;

    return `${this.CACHE_PREFIX}${userId}:${JSON.stringify({
      currency,
      type,
      status,
      startTime,
      endTime,
      page,
      limit,
      sortBy,
      sortOrder,
    })}`;
  }

  // 获取交易统计
  async getTransactionStats(
    userId: string,
    options: {
      currency?: string;
      type?: TransactionType;
      startTime?: Date;
      endTime?: Date;
    } = {},
  ): Promise<TransactionSummary> {
    const startTime = Date.now();
    try {
      const { currency, type, startTime: start, endTime: end } = options;

      // 构建查询条件
      const where = {
        userId,
        status: TransactionStatus.COMPLETED,
        ...(currency && { currency }),
        ...(type && { type }),
        ...(start && end && {
          createdAt: {
            gte: start,
            lte: end,
          },
        }),
      };

      // 聚合查询
      const stats = await this.prisma.walletTransaction.aggregate({
        where,
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
          fee: true,
        },
      });

      // 记录性能指标
      this.prometheusService.recordLatency('get_transaction_stats', Date.now() - startTime);

      return {
        totalCount: stats._count.id,
        totalAmount: stats._sum.amount || 0,
        totalFee: stats._sum.fee || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction stats: ${error.message}`);
      this.prometheusService.incrementErrors('get_transaction_stats_error');
      throw error;
    }
  }

  // 获取每日交易统计
  async getDailyTransactionStats(
    userId: string,
    options: {
      currency?: string;
      type?: TransactionType;
      startTime?: Date;
      endTime?: Date;
    } = {},
  ): Promise<DailyTransactionStats[]> {
    const startTime = Date.now();
    try {
      const { currency, type, startTime: start, endTime: end } = options;

      // 构建查询条件
      const where = {
        userId,
        status: TransactionStatus.COMPLETED,
        ...(currency && { currency }),
        ...(type && { type }),
        ...(start && end && {
          createdAt: {
            gte: start,
            lte: end,
          },
        }),
      };

      // 按日期分组查询
      const stats = await this.prisma.$queryRaw`
        SELECT 
          DATE(createdAt) as date,
          COUNT(*) as count,
          SUM(amount) as amount,
          SUM(fee) as fee
        FROM WalletTransaction
        WHERE ${where}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
      `;

      // 记录性能指标
      this.prometheusService.recordLatency('get_daily_transaction_stats', Date.now() - startTime);

      return stats.map((stat: any) => ({
        date: stat.date.toISOString().split('T')[0],
        count: Number(stat.count),
        amount: Number(stat.amount),
        fee: Number(stat.fee),
      }));
    } catch (error) {
      this.logger.error(`Failed to get daily transaction stats: ${error.message}`);
      this.prometheusService.incrementErrors('get_daily_transaction_stats_error');
      throw error;
    }
  }

  // 导出交易历史
  async exportTransactionHistory(
    userId: string,
    options: {
      currency?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      startTime?: Date;
      endTime?: Date;
      format?: 'csv' | 'excel';
    } = {},
  ): Promise<Buffer> {
    const startTime = Date.now();
    try {
      const { currency, type, status, startTime: start, endTime: end, format = 'csv' } = options;

      // 查询所有符合条件的交易
      const transactions = await this.prisma.walletTransaction.findMany({
        where: {
          userId,
          ...(currency && { currency }),
          ...(type && { type }),
          ...(status && { status }),
          ...(start && end && {
            createdAt: {
              gte: start,
              lte: end,
            },
          }),
        },
        orderBy: { createdAt: 'desc' },
      });

      // 转换为导出格式
      const exportData = transactions.map(tx => ({
        Date: tx.createdAt.toISOString(),
        Type: tx.type,
        Currency: tx.currency,
        Amount: tx.amount,
        Fee: tx.fee,
        Status: tx.status,
        TxHash: tx.txHash || '',
        FromAddress: tx.fromAddress || '',
        ToAddress: tx.toAddress || '',
        Memo: tx.memo || '',
      }));

      // 生成文件
      let buffer: Buffer;
      if (format === 'csv') {
        buffer = await this.generateCSV(exportData);
      } else {
        buffer = await this.generateExcel(exportData);
      }

      // 记录性能指标
      this.prometheusService.recordLatency('export_transaction_history', Date.now() - startTime);

      return buffer;
    } catch (error) {
      this.logger.error(`Failed to export transaction history: ${error.message}`);
      this.prometheusService.incrementErrors('export_transaction_history_error');
      throw error;
    }
  }

  private async generateCSV(data: any[]): Promise<Buffer> {
    if (data.length === 0) {
      return Buffer.from('');
    }

    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => 
        JSON.stringify(row[header] || '')
      ).join(',')
    );

    const csv = [
      headers.join(','),
      ...rows
    ].join('\n');

    return Buffer.from(csv);
  }

  private async generateExcel(data: any[]): Promise<Buffer> {
    // 这里需要引入excel库，如xlsx
    // 实现excel生成逻辑
    throw new Error('Excel export not implemented');
  }

  // 获取交易详情
  async getTransactionDetail(
    userId: string,
    transactionId: string,
  ): Promise<WalletTransaction> {
    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  // 搜索交易
  async searchTransactions(
    userId: string,
    searchTerm: string,
    options: {
      currency?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    transactions: WalletTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { currency, type, status, page = 1, limit = 20 } = options;

    const where = {
      userId,
      ...(currency && { currency }),
      ...(type && { type }),
      ...(status && { status }),
      OR: [
        { txHash: { contains: searchTerm } },
        { fromAddress: { contains: searchTerm } },
        { toAddress: { contains: searchTerm } },
        { memo: { contains: searchTerm } },
      ],
    };

    const total = await this.prisma.walletTransaction.count({ where });
    const transactions = await this.prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      transactions,
      total,
      page,
      limit,
    };
  }
}
