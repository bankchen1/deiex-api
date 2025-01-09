import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { TraderRanking } from '../types/social-trading.types';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);
  private readonly RANKING_KEY_PREFIX = 'ranking:';
  private readonly RANKING_HISTORY_PREFIX = 'ranking:history:';
  private readonly CACHE_TTL = 3600; // 1小时缓存

  // 排名类别及其权重
  private readonly RANKING_CATEGORIES = {
    PnL: { weight: 0.3, minTrades: 20 },
    WinRate: { weight: 0.2, minTrades: 30 },
    Followers: { weight: 0.15, minTrades: 10 },
    Sharpe: { weight: 0.25, minTrades: 50 },
    Volume: { weight: 0.1, minTrades: 20 },
  };

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {}

  // 每小时更新排名
  @Cron('0 * * * *')
  async updateRankings() {
    const startTime = Date.now();
    try {
      // 获取所有活跃交易员
      const traders = await this.prisma.traderMetrics.findMany({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 最近7天活跃
          },
        },
      });

      // 计算各个类别的排名
      await Promise.all([
        this.updateCategoryRanking('PnL', traders),
        this.updateCategoryRanking('WinRate', traders),
        this.updateCategoryRanking('Followers', traders),
        this.updateCategoryRanking('Sharpe', traders),
        this.updateCategoryRanking('Volume', traders),
      ]);

      // 计算综合排名
      await this.updateOverallRanking(traders);

      // 更新排名历史
      await this.saveRankingHistory();

      // 分发排名奖励
      await this.distributeRankingRewards();

      // 记录性能指标
      this.prometheusService.recordLatency('update_rankings', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Failed to update rankings: ${error.message}`);
      this.prometheusService.incrementErrors('update_rankings_error');
    }
  }

  private async updateCategoryRanking(
    category: string,
    traders: any[],
  ) {
    const { weight, minTrades } = this.RANKING_CATEGORIES[category];

    // 过滤掉交易次数不足的交易员
    const qualifiedTraders = traders.filter(t => t.totalTrades >= minTrades);

    // 根据不同类别排序
    const sortedTraders = qualifiedTraders.sort((a, b) => {
      switch (category) {
        case 'PnL':
          return b.monthlyPnL - a.monthlyPnL;
        case 'WinRate':
          return b.winRate - a.winRate;
        case 'Followers':
          return b.activeFollowers - a.activeFollowers;
        case 'Sharpe':
          return b.sharpeRatio - a.sharpeRatio;
        case 'Volume':
          return b.monthlyVolume - a.monthlyVolume;
        default:
          return 0;
      }
    });

    // 更新排名
    const rankings: TraderRanking[] = sortedTraders.map((trader, index) => ({
      traderId: trader.traderId,
      rank: index + 1,
      category,
      score: this.calculateCategoryScore(trader, category),
      previousRank: 0, // 将在后面更新
      updatedAt: new Date(),
    }));

    // 获取上次排名
    const previousRankings = await this.prisma.traderRanking.findMany({
      where: { category },
    });

    // 更新排名，包括历史排名
    await this.prisma.$transaction(async (prisma) => {
      // 删除旧排名
      await prisma.traderRanking.deleteMany({
        where: { category },
      });

      // 插入新排名
      for (const ranking of rankings) {
        const previous = previousRankings.find(r => r.traderId === ranking.traderId);
        ranking.previousRank = previous?.rank || 0;
        await prisma.traderRanking.create({
          data: ranking,
        });
      }
    });

    // 更新Redis缓存
    await this.redis.set(
      `${this.RANKING_KEY_PREFIX}${category}`,
      JSON.stringify(rankings),
      'EX',
      this.CACHE_TTL
    );

    // 发送排名变化事件
    for (const ranking of rankings) {
      if (ranking.previousRank !== 0 && ranking.rank !== ranking.previousRank) {
        this.eventEmitter.emit('trader.ranking.changed', {
          traderId: ranking.traderId,
          category,
          newRank: ranking.rank,
          previousRank: ranking.previousRank,
        });
      }
    }
  }

  private async updateOverallRanking(traders: any[]) {
    // 获取所有类别的排名
    const categoryRankings = await Promise.all(
      Object.keys(this.RANKING_CATEGORIES).map(category =>
        this.prisma.traderRanking.findMany({
          where: { category },
        })
      )
    );

    // 计算综合得分
    const overallScores = traders.map(trader => {
      let totalScore = 0;
      let totalWeight = 0;

      Object.keys(this.RANKING_CATEGORIES).forEach((category, index) => {
        const ranking = categoryRankings[index].find(r => r.traderId === trader.traderId);
        if (ranking) {
          const { weight } = this.RANKING_CATEGORIES[category];
          totalScore += ranking.score * weight;
          totalWeight += weight;
        }
      });

      return {
        traderId: trader.traderId,
        score: totalWeight > 0 ? totalScore / totalWeight : 0,
      };
    });

    // 排序并生成排名
    const sortedTraders = overallScores
      .sort((a, b) => b.score - a.score)
      .map((trader, index) => ({
        traderId: trader.traderId,
        rank: index + 1,
        category: 'Overall',
        score: trader.score,
        previousRank: 0,
        updatedAt: new Date(),
      }));

    // 更新数据库和缓存
    await this.updateRankingData('Overall', sortedTraders);
  }

  private async updateRankingData(
    category: string,
    rankings: TraderRanking[],
  ) {
    // 获取上次排名
    const previousRankings = await this.prisma.traderRanking.findMany({
      where: { category },
    });

    // 更新排名
    await this.prisma.$transaction(async (prisma) => {
      await prisma.traderRanking.deleteMany({
        where: { category },
      });

      for (const ranking of rankings) {
        const previous = previousRankings.find(r => r.traderId === ranking.traderId);
        ranking.previousRank = previous?.rank || 0;
        await prisma.traderRanking.create({
          data: ranking,
        });
      }
    });

    // 更新缓存
    await this.redis.set(
      `${this.RANKING_KEY_PREFIX}${category}`,
      JSON.stringify(rankings),
      'EX',
      this.CACHE_TTL
    );
  }

  private calculateCategoryScore(trader: any, category: string): number {
    switch (category) {
      case 'PnL':
        return Math.min(1, Math.max(0, trader.monthlyPnL / 1000000)); // 标准化到0-1
      case 'WinRate':
        return trader.winRate / 100;
      case 'Followers':
        return Math.min(1, Math.max(0, trader.activeFollowers / 1000));
      case 'Sharpe':
        return Math.min(1, Math.max(0, trader.sharpeRatio / 5));
      case 'Volume':
        return Math.min(1, Math.max(0, trader.monthlyVolume / 10000000));
      default:
        return 0;
    }
  }

  private async saveRankingHistory() {
    const timestamp = new Date();
    const categories = [...Object.keys(this.RANKING_CATEGORIES), 'Overall'];

    for (const category of categories) {
      const rankings = await this.prisma.traderRanking.findMany({
        where: { category },
        take: 100, // 只保存前100名
      });

      await this.prisma.rankingHistory.createMany({
        data: rankings.map(r => ({
          ...r,
          timestamp,
        })),
      });
    }
  }

  private async distributeRankingRewards() {
    const rewardConfig = {
      Overall: {
        1: 1000, // 第一名奖励1000 USDT
        2: 500,
        3: 300,
        4: 200,
        5: 100,
      },
    };

    const rankings = await this.prisma.traderRanking.findMany({
      where: {
        category: 'Overall',
        rank: { lte: 5 },
      },
    });

    for (const ranking of rankings) {
      const reward = rewardConfig.Overall[ranking.rank];
      if (reward) {
        await this.prisma.$transaction(async (prisma) => {
          // 创建奖励记录
          await prisma.rankingReward.create({
            data: {
              traderId: ranking.traderId,
              amount: reward,
              category: 'Overall',
              rank: ranking.rank,
              status: 'PENDING',
              createdAt: new Date(),
            },
          });

          // 更新用户余额
          await prisma.userBalance.update({
            where: { userId: ranking.traderId },
            data: {
              balance: {
                increment: reward,
              },
            },
          });
        });

        // 发送奖励通知
        this.eventEmitter.emit('trader.reward.distributed', {
          traderId: ranking.traderId,
          amount: reward,
          rank: ranking.rank,
          category: 'Overall',
        });
      }
    }
  }

  // 公共API方法
  async getRanking(
    category: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<TraderRanking[]> {
    const cacheKey = `${this.RANKING_KEY_PREFIX}${category}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const rankings = JSON.parse(cached);
      return rankings.slice((page - 1) * limit, page * limit);
    }

    const rankings = await this.prisma.traderRanking.findMany({
      where: { category },
      orderBy: { rank: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return rankings;
  }

  async getTraderRankings(traderId: string): Promise<TraderRanking[]> {
    return await this.prisma.traderRanking.findMany({
      where: { traderId },
    });
  }

  async getRankingHistory(
    category: string,
    traderId?: string,
    days: number = 30,
  ) {
    return await this.prisma.rankingHistory.findMany({
      where: {
        category,
        traderId,
        timestamp: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  }

  async getRewards(traderId: string) {
    return await this.prisma.rankingReward.findMany({
      where: { traderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
