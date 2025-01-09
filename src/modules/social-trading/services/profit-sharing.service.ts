import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { ProfitSharing } from '../types/social-trading.types';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class ProfitSharingService {
  private readonly logger = new Logger(ProfitSharingService.name);
  private readonly PROFIT_SHARING_PREFIX = 'profit:sharing:';
  private readonly CACHE_TTL = 3600; // 1小时缓存

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {}

  // 每天凌晨2点结算收益分成
  @Cron('0 2 * * *')
  async settleDailyProfitSharing() {
    const startTime = Date.now();
    try {
      // 获取所有活跃的跟单关系
      const followers = await this.prisma.follower.findMany({
        where: { active: true },
        include: {
          strategy: true,
        },
      });

      // 按交易员分组处理
      const traderFollowers = this.groupByTrader(followers);

      for (const [traderId, followers] of traderFollowers) {
        await this.processTraderProfitSharing(traderId, followers);
      }

      // 记录性能指标
      this.prometheusService.recordLatency('settle_profit_sharing', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to settle profit sharing: ${error.message}`);
      this.prometheusService.incrementErrors('settle_profit_sharing_error');
    }
  }

  private groupByTrader(followers: any[]): Map<string, any[]> {
    const map = new Map();
    for (const follower of followers) {
      if (!map.has(follower.traderId)) {
        map.set(follower.traderId, []);
      }
      map.get(follower.traderId).push(follower);
    }
    return map;
  }

  private async processTraderProfitSharing(traderId: string, followers: any[]) {
    await this.prisma.$transaction(async (prisma) => {
      // 获取交易员的收益数据
      const traderPnL = await this.getTraderPnL(traderId);
      if (traderPnL <= 0) return; // 没有收益就不需要分成

      for (const follower of followers) {
        await this.calculateAndSettleFollowerProfit(
          prisma,
          traderId,
          follower,
          traderPnL
        );
      }
    });
  }

  private async calculateAndSettleFollowerProfit(
    prisma: any,
    traderId: string,
    follower: any,
    traderPnL: number,
  ) {
    try {
      // 计算跟随者的收益
      const followerPnL = await this.getFollowerPnL(follower.followerId, traderId);
      if (followerPnL <= 0) return; // 跟随者没有盈利就不需要分成

      // 计算管理费和绩效费
      const { managementFee, performanceFee } = this.calculateFees(
        followerPnL,
        follower.strategy
      );

      // 创建分成记录
      const profitSharing = await prisma.profitSharing.create({
        data: {
          traderId,
          followerId: follower.followerId,
          amount: managementFee + performanceFee,
          managementFee,
          performanceFee,
          period: 'Daily',
          status: 'PENDING',
          createdAt: new Date(),
        },
      });

      // 更新余额
      await Promise.all([
        // 扣除跟随者余额
        prisma.userBalance.update({
          where: { userId: follower.followerId },
          data: {
            balance: {
              decrement: managementFee + performanceFee,
            },
          },
        }),
        // 增加交易员余额
        prisma.userBalance.update({
          where: { userId: traderId },
          data: {
            balance: {
              increment: managementFee + performanceFee,
            },
          },
        }),
      ]);

      // 更新分成状态
      await prisma.profitSharing.update({
        where: { id: profitSharing.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      // 发送分成完成事件
      this.eventEmitter.emit('profit.sharing.settled', {
        traderId,
        followerId: follower.followerId,
        amount: managementFee + performanceFee,
        profitSharing,
      });

    } catch (error) {
      this.logger.error(
        `Failed to process profit sharing for follower ${follower.followerId}: ${error.message}`
      );
      throw error;
    }
  }

  private async getTraderPnL(traderId: string): Promise<number> {
    const trades = await this.prisma.trade.findMany({
      where: {
        userId: traderId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 最近24小时
        },
      },
    });

    return trades.reduce((sum, trade) => sum + trade.pnl, 0);
  }

  private async getFollowerPnL(
    followerId: string,
    traderId: string,
  ): Promise<number> {
    const trades = await this.prisma.trade.findMany({
      where: {
        userId: followerId,
        copyFromId: traderId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return trades.reduce((sum, trade) => sum + trade.pnl, 0);
  }

  private calculateFees(
    pnl: number,
    strategy: any,
  ): { managementFee: number; performanceFee: number } {
    // 管理费 = 持仓市值 * 管理费率 / 365
    const managementFee = (pnl * strategy.managementFee) / 365;

    // 绩效费 = 收益 * 绩效费率
    const performanceFee = pnl * strategy.performanceFee;

    return { managementFee, performanceFee };
  }

  // 公共API方法
  async getProfitSharingHistory(
    traderId?: string,
    followerId?: string,
    period: string = 'Daily',
    startDate?: Date,
    endDate?: Date,
  ): Promise<ProfitSharing[]> {
    return await this.prisma.profitSharing.findMany({
      where: {
        traderId,
        followerId,
        period,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProfitSharingSummary(
    traderId: string,
    period: 'Daily' | 'Weekly' | 'Monthly' = 'Monthly',
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period === 'Daily' ? 30 : period === 'Weekly' ? 90 : 365));

    const profitSharing = await this.prisma.profitSharing.findMany({
      where: {
        traderId,
        createdAt: { gte: startDate },
        status: 'PROCESSED',
      },
    });

    const totalAmount = profitSharing.reduce((sum, ps) => sum + ps.amount, 0);
    const totalManagementFee = profitSharing.reduce((sum, ps) => sum + ps.managementFee, 0);
    const totalPerformanceFee = profitSharing.reduce((sum, ps) => sum + ps.performanceFee, 0);

    return {
      totalAmount,
      totalManagementFee,
      totalPerformanceFee,
      totalSettlements: profitSharing.length,
      averageAmount: profitSharing.length > 0 ? totalAmount / profitSharing.length : 0,
    };
  }

  async getFollowerProfitSharingSummary(
    followerId: string,
    traderId?: string,
    period: 'Daily' | 'Weekly' | 'Monthly' = 'Monthly',
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period === 'Daily' ? 30 : period === 'Weekly' ? 90 : 365));

    const profitSharing = await this.prisma.profitSharing.findMany({
      where: {
        followerId,
        traderId,
        createdAt: { gte: startDate },
        status: 'PROCESSED',
      },
    });

    return {
      totalPaid: profitSharing.reduce((sum, ps) => sum + ps.amount, 0),
      totalManagementFee: profitSharing.reduce((sum, ps) => sum + ps.managementFee, 0),
      totalPerformanceFee: profitSharing.reduce((sum, ps) => sum + ps.performanceFee, 0),
      totalSettlements: profitSharing.length,
    };
  }
}
