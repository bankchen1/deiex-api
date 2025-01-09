import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../../shared/services/prometheus.service';
import {
  CopyTrader,
  CopyTrade,
  CopyTraderStatus,
  CopyTradeStatus,
  TraderStats,
  CopyTradeEvent,
  RiskMetrics,
} from '../types/copy-trading.types';
import {
  CreateCopyTradingDto,
  UpdateCopyTradingDto,
  CopyTradingDto,
} from '../dto/copy-trading.dto';

@Injectable()
export class CopyTradingService {
  private readonly logger = new Logger(CopyTradingService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.subscribeToEvents();
  }

  async createCopyTrader(userId: string, data: CreateCopyTradingDto): Promise<CopyTrader> {
    try {
      const trader: CopyTrader = {
        id: this.generateId(),
        userId,
        name: data.name,
        description: data.description,
        status: CopyTraderStatus.ACTIVE,
        profitRate: 0,
        winRate: 0,
        totalTrades: 0,
        followers: 0,
        aum: 0,
        maxFollowers: data.maxFollowers,
        minCopyAmount: data.minCopyAmount,
        maxCopyAmount: data.maxCopyAmount,
        commission: data.commission,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.redisService.set(
        `trader:${trader.id}`,
        JSON.stringify(trader),
        0, // 永久保存
      );

      this.prometheusService.incrementTraderCount();
      return trader;
    } catch (error) {
      this.logger.error(
        `Failed to create copy trader: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async followTrader(followerId: string, traderId: string, data: CopyTradingDto): Promise<CopyTrade> {
    try {
      // 验证交易者是否存在且活跃
      const trader = await this.getTrader(traderId);
      if (!trader || trader.status !== CopyTraderStatus.ACTIVE) {
        throw new Error('Trader not found or inactive');
      }

      // 验证是否超过最大跟随者数量
      if (trader.followers >= trader.maxFollowers) {
        throw new Error('Trader has reached maximum followers');
      }

      // 验证复制金额是否在允许范围内
      if (
        data.copyAmount < trader.minCopyAmount ||
        data.copyAmount > trader.maxCopyAmount
      ) {
        throw new Error('Copy amount out of range');
      }

      const copyTrade: CopyTrade = {
        id: this.generateId(),
        followerId,
        traderId,
        status: CopyTradeStatus.ACTIVE,
        copyAmount: data.copyAmount,
        profitRate: 0,
        pnl: 0,
        maxDrawdown: 0,
        copyRatio: data.copyRatio,
        maxRiskPerTrade: data.maxRiskPerTrade,
        stopLossPercentage: data.stopLossPercentage,
        takeProfitPercentage: data.takeProfitPercentage,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 保存复制交易记录
      await this.redisService.set(
        `copy:${copyTrade.id}`,
        JSON.stringify(copyTrade),
        0,
      );

      // 更新交易者统计数据
      trader.followers += 1;
      trader.aum += data.copyAmount;
      await this.updateTrader(trader);

      this.prometheusService.incrementFollowerCount(traderId);
      return copyTrade;
    } catch (error) {
      this.logger.error(
        `Failed to follow trader: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async unfollowTrader(followerId: string, copyTradeId: string): Promise<void> {
    try {
      const copyTrade = await this.getCopyTrade(copyTradeId);
      if (!copyTrade || copyTrade.followerId !== followerId) {
        throw new Error('Copy trade not found');
      }

      // 更新复制交易状态
      copyTrade.status = CopyTradeStatus.STOPPED;
      await this.updateCopyTrade(copyTrade);

      // 更新交易者统计数据
      const trader = await this.getTrader(copyTrade.traderId);
      if (trader) {
        trader.followers -= 1;
        trader.aum -= copyTrade.copyAmount;
        await this.updateTrader(trader);
      }

      this.prometheusService.decrementFollowerCount(copyTrade.traderId);
    } catch (error) {
      this.logger.error(
        `Failed to unfollow trader: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateCopyTradeSettings(
    followerId: string,
    copyTradeId: string,
    data: UpdateCopyTradingDto,
  ): Promise<CopyTrade> {
    try {
      const copyTrade = await this.getCopyTrade(copyTradeId);
      if (!copyTrade || copyTrade.followerId !== followerId) {
        throw new Error('Copy trade not found');
      }

      const trader = await this.getTrader(copyTrade.traderId);
      if (!trader) {
        throw new Error('Trader not found');
      }

      // 验证更新的复制金额是否在允许范围内
      if (data.copyAmount) {
        if (
          data.copyAmount < trader.minCopyAmount ||
          data.copyAmount > trader.maxCopyAmount
        ) {
          throw new Error('Copy amount out of range');
        }
        
        // 更新交易者的 AUM
        trader.aum = trader.aum - copyTrade.copyAmount + data.copyAmount;
        await this.updateTrader(trader);
      }

      // 更新复制交易设置
      Object.assign(copyTrade, {
        ...data,
        updatedAt: new Date(),
      });

      await this.updateCopyTrade(copyTrade);
      return copyTrade;
    } catch (error) {
      this.logger.error(
        `Failed to update copy trade settings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getTraderStats(traderId: string): Promise<TraderStats> {
    try {
      const stats = await this.redisService.get(`stats:${traderId}`);
      if (!stats) {
        throw new Error('Trader stats not found');
      }
      return JSON.parse(stats);
    } catch (error) {
      this.logger.error(
        `Failed to get trader stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getRiskMetrics(copyTradeId: string): Promise<RiskMetrics> {
    try {
      const metrics = await this.redisService.get(`risk:${copyTradeId}`);
      if (!metrics) {
        throw new Error('Risk metrics not found');
      }
      return JSON.parse(metrics);
    } catch (error) {
      this.logger.error(
        `Failed to get risk metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleTradeEvent(event: CopyTradeEvent): Promise<void> {
    try {
      // 获取交易者的所有跟随者
      const followers = await this.getActiveFollowers(event.traderId);

      // 为每个跟随者复制交易
      for (const follower of followers) {
        await this.copyTradeForFollower(event, follower);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle trade event: ${error.message}`,
        error.stack,
      );
    }
  }

  private async copyTradeForFollower(
    event: CopyTradeEvent,
    copyTrade: CopyTrade,
  ): Promise<void> {
    try {
      // 计算复制数量
      const copyAmount = event.amount * copyTrade.copyRatio;

      // 验证风险限制
      if (!this.validateRiskLimits(copyTrade, copyAmount)) {
        this.logger.warn(
          `Risk limits exceeded for follower ${copyTrade.followerId}`,
        );
        return;
      }

      // 发送复制交易事件
      this.eventEmitter.emit('copy.trade', {
        followerId: copyTrade.followerId,
        traderId: event.traderId,
        symbol: event.symbol,
        side: event.side,
        price: event.price,
        amount: copyAmount,
        leverage: event.leverage,
        stopLoss: this.calculateStopLoss(event, copyTrade),
        takeProfit: this.calculateTakeProfit(event, copyTrade),
      });
    } catch (error) {
      this.logger.error(
        `Failed to copy trade for follower: ${error.message}`,
        error.stack,
      );
    }
  }

  private validateRiskLimits(copyTrade: CopyTrade, amount: number): boolean {
    // 验证单笔交易风险
    if (amount > copyTrade.maxRiskPerTrade) {
      return false;
    }

    // 验证总体亏损限制
    if (copyTrade.pnl < -copyTrade.copyAmount * copyTrade.stopLossPercentage) {
      return false;
    }

    return true;
  }

  private calculateStopLoss(
    event: CopyTradeEvent,
    copyTrade: CopyTrade,
  ): number {
    const stopLossPercentage = copyTrade.stopLossPercentage / 100;
    return event.side === 'LONG'
      ? event.price * (1 - stopLossPercentage)
      : event.price * (1 + stopLossPercentage);
  }

  private calculateTakeProfit(
    event: CopyTradeEvent,
    copyTrade: CopyTrade,
  ): number {
    const takeProfitPercentage = copyTrade.takeProfitPercentage / 100;
    return event.side === 'LONG'
      ? event.price * (1 + takeProfitPercentage)
      : event.price * (1 - takeProfitPercentage);
  }

  private async getActiveFollowers(traderId: string): Promise<CopyTrade[]> {
    try {
      const keys = await this.redisService.keys(`copy:*`);
      const followers: CopyTrade[] = [];

      for (const key of keys) {
        const copyTrade = await this.getCopyTrade(key.split(':')[1]);
        if (
          copyTrade &&
          copyTrade.traderId === traderId &&
          copyTrade.status === CopyTradeStatus.ACTIVE
        ) {
          followers.push(copyTrade);
        }
      }

      return followers;
    } catch (error) {
      this.logger.error(
        `Failed to get active followers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async getTrader(traderId: string): Promise<CopyTrader | null> {
    try {
      const trader = await this.redisService.get(`trader:${traderId}`);
      return trader ? JSON.parse(trader) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get trader: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async getCopyTrade(copyTradeId: string): Promise<CopyTrade | null> {
    try {
      const copyTrade = await this.redisService.get(`copy:${copyTradeId}`);
      return copyTrade ? JSON.parse(copyTrade) : null;
    } catch (error) {
      this.logger.error(
        `Failed to get copy trade: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateTrader(trader: CopyTrader): Promise<void> {
    try {
      trader.updatedAt = new Date();
      await this.redisService.set(
        `trader:${trader.id}`,
        JSON.stringify(trader),
        0,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update trader: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateCopyTrade(copyTrade: CopyTrade): Promise<void> {
    try {
      copyTrade.updatedAt = new Date();
      await this.redisService.set(
        `copy:${copyTrade.id}`,
        JSON.stringify(copyTrade),
        0,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update copy trade: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private subscribeToEvents(): void {
    // 订阅交易事件
    this.eventEmitter.on('trade', async (event: CopyTradeEvent) => {
      await this.handleTradeEvent(event);
    });

    // 订阅风险更新事件
    this.eventEmitter.on(
      'risk.update',
      async ({
        copyTradeId,
        metrics,
      }: {
        copyTradeId: string;
        metrics: RiskMetrics;
      }) => {
        try {
          await this.redisService.set(
            `risk:${copyTradeId}`,
            JSON.stringify(metrics),
            60 * 60, // 1 hour cache
          );
        } catch (error) {
          this.logger.error(
            `Failed to update risk metrics: ${error.message}`,
            error.stack,
          );
        }
      },
    );

    // 订阅统计数据更新事件
    this.eventEmitter.on(
      'stats.update',
      async ({
        traderId,
        stats,
      }: {
        traderId: string;
        stats: TraderStats;
      }) => {
        try {
          await this.redisService.set(
            `stats:${traderId}`,
            JSON.stringify(stats),
            60 * 60, // 1 hour cache
          );

          // 更新 Prometheus 指标
          this.prometheusService.setTraderProfitRate(
            traderId,
            stats.totalPnL / stats.totalTrades,
          );
          this.prometheusService.setTraderWinRate(
            traderId,
            stats.winRate,
          );
        } catch (error) {
          this.logger.error(
            `Failed to update trader stats: ${error.message}`,
            error.stack,
          );
        }
      },
    );
  }
}
