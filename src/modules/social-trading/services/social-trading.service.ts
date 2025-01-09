import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import {
  TraderProfile,
  TradingStrategy,
  TradingPost,
  Comment,
  TraderMetrics,
  FollowerMetrics,
} from '../types/social-trading.types';
import { CopyTradingService } from '../../copy-trading/services/copy-trading.service';

@Injectable()
export class SocialTradingService {
  private readonly logger = new Logger(SocialTradingService.name);
  private readonly CACHE_TTL = 3600; // 1小时缓存

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly copyTradingService: CopyTradingService,
  ) {}

  // 交易员资料管理
  async createTraderProfile(userId: string, profile: Partial<TraderProfile>): Promise<TraderProfile> {
    const startTime = Date.now();
    try {
      // 验证用户是否有资格成为交易员
      await this.validateTraderEligibility(userId);

      const newProfile = await this.prisma.traderProfile.create({
        data: {
          userId,
          ...profile,
          verified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 创建初始交易员指标
      await this.initializeTraderMetrics(userId);

      // 清除缓存
      await this.redis.del(`trader:profile:${userId}`);

      // 记录性能指标
      this.prometheusService.recordLatency('create_trader_profile', Date.now() - startTime);

      return newProfile;
    } catch (error) {
      this.logger.error(`Failed to create trader profile: ${error.message}`);
      this.prometheusService.incrementErrors('create_trader_profile_error');
      throw error;
    }
  }

  private async validateTraderEligibility(userId: string): Promise<boolean> {
    // 检查用户是否完成KYC
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });

    if (!user || user.kycStatus !== 'VERIFIED') {
      throw new Error('User must complete KYC verification to become a trader');
    }

    // 检查交易历史
    const tradingHistory = await this.prisma.trade.findMany({
      where: { userId },
      select: { id: true },
    });

    if (tradingHistory.length < 50) { // 至少50笔交易
      throw new Error('Minimum 50 trades required to become a trader');
    }

    return true;
  }

  private async initializeTraderMetrics(traderId: string) {
    await this.prisma.traderMetrics.create({
      data: {
        traderId,
        totalFollowers: 0,
        activeFollowers: 0,
        totalAUM: 0,
        totalPnL: 0,
        monthlyPnL: 0,
        winRate: 0,
        averageReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        profitFactor: 0,
        averageTradeDuration: 0,
        updatedAt: new Date(),
      },
    });
  }

  // 交易策略管理
  async createTradingStrategy(
    traderId: string,
    strategy: Partial<TradingStrategy>,
  ): Promise<TradingStrategy> {
    const startTime = Date.now();
    try {
      const newStrategy = await this.prisma.tradingStrategy.create({
        data: {
          traderId,
          ...strategy,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 发送策略创建事件
      this.eventEmitter.emit('trading.strategy.created', {
        traderId,
        strategy: newStrategy,
      });

      // 清除缓存
      await this.redis.del(`trader:strategies:${traderId}`);

      this.prometheusService.recordLatency('create_trading_strategy', Date.now() - startTime);
      return newStrategy;
    } catch (error) {
      this.logger.error(`Failed to create trading strategy: ${error.message}`);
      this.prometheusService.incrementErrors('create_trading_strategy_error');
      throw error;
    }
  }

  // 社交动态管理
  async createTradingPost(
    traderId: string,
    post: Partial<TradingPost>,
  ): Promise<TradingPost> {
    const startTime = Date.now();
    try {
      const newPost = await this.prisma.tradingPost.create({
        data: {
          traderId,
          ...post,
          likes: 0,
          comments: 0,
          shares: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 发送动态创建事件
      this.eventEmitter.emit('trading.post.created', {
        traderId,
        post: newPost,
      });

      // 推送给关注者
      await this.notifyFollowers(traderId, 'NewPost', newPost);

      this.prometheusService.recordLatency('create_trading_post', Date.now() - startTime);
      return newPost;
    } catch (error) {
      this.logger.error(`Failed to create trading post: ${error.message}`);
      this.prometheusService.incrementErrors('create_trading_post_error');
      throw error;
    }
  }

  // 评论管理
  async addComment(
    userId: string,
    postId: string,
    content: string,
    replyTo?: string,
  ): Promise<Comment> {
    const startTime = Date.now();
    try {
      const comment = await this.prisma.comment.create({
        data: {
          userId,
          postId,
          content,
          replyTo,
          likes: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 更新帖子评论数
      await this.prisma.tradingPost.update({
        where: { id: postId },
        data: {
          comments: {
            increment: 1,
          },
        },
      });

      // 发送评论事件
      this.eventEmitter.emit('trading.comment.created', {
        userId,
        postId,
        comment,
      });

      this.prometheusService.recordLatency('add_comment', Date.now() - startTime);
      return comment;
    } catch (error) {
      this.logger.error(`Failed to add comment: ${error.message}`);
      this.prometheusService.incrementErrors('add_comment_error');
      throw error;
    }
  }

  // 指标更新
  async updateTraderMetrics(traderId: string): Promise<TraderMetrics> {
    const startTime = Date.now();
    try {
      // 获取交易历史
      const trades = await this.prisma.trade.findMany({
        where: {
          userId: traderId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 最近30天
          },
        },
      });

      // 计算交易指标
      const metrics = this.calculateTraderMetrics(trades);

      // 更新数据库
      const updatedMetrics = await this.prisma.traderMetrics.update({
        where: { traderId },
        data: {
          ...metrics,
          updatedAt: new Date(),
        },
      });

      // 清除缓存
      await this.redis.del(`trader:metrics:${traderId}`);

      this.prometheusService.recordLatency('update_trader_metrics', Date.now() - startTime);
      return updatedMetrics;
    } catch (error) {
      this.logger.error(`Failed to update trader metrics: ${error.message}`);
      this.prometheusService.incrementErrors('update_trader_metrics_error');
      throw error;
    }
  }

  private calculateTraderMetrics(trades: any[]): Partial<TraderMetrics> {
    if (trades.length === 0) {
      return {
        totalPnL: 0,
        monthlyPnL: 0,
        winRate: 0,
        averageReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        profitFactor: 0,
        averageTradeDuration: 0,
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const returns = trades.map(t => t.pnl / t.margin);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    return {
      totalPnL,
      monthlyPnL: totalPnL, // 因为已经在查询时过滤了最近30天
      winRate: (winningTrades.length / trades.length) * 100,
      averageReturn: avgReturn * 100,
      sharpeRatio: stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(365) : 0,
      maxDrawdown: this.calculateMaxDrawdown(trades),
      profitFactor: this.calculateProfitFactor(trades),
      averageTradeDuration: this.calculateAverageDuration(trades),
    };
  }

  private calculateMaxDrawdown(trades: any[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = (peak - runningPnL) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100;
  }

  private calculateProfitFactor(trades: any[]): number {
    const grossProfit = trades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(
      trades
        .filter(t => t.pnl < 0)
        .reduce((sum, t) => sum + t.pnl, 0)
    );

    return grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
  }

  private calculateAverageDuration(trades: any[]): number {
    const durations = trades.map(t => 
      new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()
    );
    return durations.reduce((sum, d) => sum + d, 0) / durations.length / (1000 * 60); // 转换为分钟
  }

  // 关注者通知
  private async notifyFollowers(
    traderId: string,
    type: string,
    content: any,
  ): Promise<void> {
    const followers = await this.prisma.follower.findMany({
      where: { traderId },
      select: { followerId: true },
    });

    const notifications = followers.map(f => ({
      userId: f.followerId,
      type,
      content: JSON.stringify(content),
      read: false,
      createdAt: new Date(),
    }));

    await this.prisma.notification.createMany({
      data: notifications,
    });

    // 发送WebSocket通知
    for (const follower of followers) {
      this.eventEmitter.emit('user.notification', {
        userId: follower.followerId,
        type,
        content,
      });
    }
  }

  // 公共API方法
  async getTraderProfile(traderId: string): Promise<TraderProfile> {
    const cacheKey = `trader:profile:${traderId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const profile = await this.prisma.traderProfile.findUnique({
      where: { userId: traderId },
    });

    if (profile) {
      await this.redis.set(cacheKey, JSON.stringify(profile), 'EX', this.CACHE_TTL);
    }

    return profile;
  }

  async getTraderStrategies(traderId: string): Promise<TradingStrategy[]> {
    const cacheKey = `trader:strategies:${traderId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const strategies = await this.prisma.tradingStrategy.findMany({
      where: { traderId, active: true },
    });

    await this.redis.set(cacheKey, JSON.stringify(strategies), 'EX', this.CACHE_TTL);
    return strategies;
  }

  async getTraderPosts(
    traderId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<TradingPost[]> {
    return await this.prisma.tradingPost.findMany({
      where: { traderId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getTraderMetrics(traderId: string): Promise<TraderMetrics> {
    const cacheKey = `trader:metrics:${traderId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const metrics = await this.prisma.traderMetrics.findUnique({
      where: { traderId },
    });

    if (metrics) {
      await this.redis.set(cacheKey, JSON.stringify(metrics), 'EX', this.CACHE_TTL);
    }

    return metrics;
  }

  async getFollowerMetrics(
    followerId: string,
    traderId: string,
  ): Promise<FollowerMetrics> {
    return await this.prisma.followerMetrics.findUnique({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
    });
  }
}
