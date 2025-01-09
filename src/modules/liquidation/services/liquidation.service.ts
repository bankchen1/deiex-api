import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../../shared/services/prometheus.service';
import {
  LiquidationEvent,
  LiquidationQueue,
  LiquidationPosition,
  LiquidationStatus,
  InsuranceFundOperation,
  LiquidationStats,
} from '../types/liquidation.types';
import { Position, PositionSide } from '../../perpetual/types/perpetual.types';

@Injectable()
export class LiquidationService {
  private readonly logger = new Logger(LiquidationService.name);
  private readonly liquidationQueues = new Map<string, LiquidationQueue>();
  private readonly insuranceFundBalances = new Map<string, number>();
  private readonly maintenanceMarginRatios = new Map<string, number>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.initializeConfigs();
    this.subscribeToEvents();
  }

  private async initializeConfigs(): Promise<void> {
    try {
      // 初始化维持保证金率
      const marginRatios = this.configService.get<Record<string, number>>(
        'perpetual.maintenanceMarginRatios',
      );
      if (marginRatios) {
        Object.entries(marginRatios).forEach(([symbol, ratio]) => {
          this.maintenanceMarginRatios.set(symbol, ratio);
        });
      }

      // 初始化保险基金余额
      const insuranceFunds = this.configService.get<Record<string, number>>(
        'perpetual.insuranceFunds',
      );
      if (insuranceFunds) {
        Object.entries(insuranceFunds).forEach(([symbol, balance]) => {
          this.insuranceFundBalances.set(symbol, balance);
        });
      }

      // 初始化清算队列
      await this.initializeLiquidationQueues();

      this.logger.log('Liquidation service initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize liquidation service: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkPositionLiquidation(position: Position): Promise<boolean> {
    try {
      const maintenanceMarginRatio = this.getMaintenanceMarginRatio(position.symbol);
      const currentPrice = await this.getCurrentPrice(position.symbol);

      // 计算维持保证金
      const maintMargin = position.amount * currentPrice * maintenanceMarginRatio;
      const unrealizedPnl = this.calculateUnrealizedPnl(position, currentPrice);
      const marginRatio = (position.margin + unrealizedPnl) / maintMargin;

      // 如果保证金率低于1，触发清算
      if (marginRatio < 1) {
        await this.triggerLiquidation(position, currentPrice);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check position liquidation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async processLiquidationQueue(symbol: string): Promise<void> {
    try {
      const queue = this.liquidationQueues.get(symbol);
      if (!queue || queue.positions.length === 0) {
        return;
      }

      // 按优先级排序
      queue.positions.sort((a, b) => b.priority - a.priority);

      for (const position of queue.positions) {
        try {
          await this.executeLiquidation(position, symbol);
        } catch (error) {
          this.logger.error(
            `Failed to execute liquidation for position ${position.positionId}: ${error.message}`,
            error.stack,
          );
        }
      }

      // 更新队列
      queue.positions = [];
      queue.lastUpdateTime = new Date();
      await this.saveLiquidationQueue(queue);
    } catch (error) {
      this.logger.error(
        `Failed to process liquidation queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getInsuranceFundBalance(symbol: string): Promise<number> {
    return this.insuranceFundBalances.get(symbol) || 0;
  }

  async getLiquidationStats(symbol: string): Promise<LiquidationStats> {
    try {
      const stats = await this.redisService.get(`liquidation:stats:${symbol}`);
      return stats ? JSON.parse(stats) : this.createEmptyStats(symbol);
    } catch (error) {
      this.logger.error(
        `Failed to get liquidation stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async triggerLiquidation(
    position: Position,
    currentPrice: number,
  ): Promise<void> {
    try {
      const liquidationEvent: LiquidationEvent = {
        userId: position.userId,
        positionId: position.id,
        symbol: position.symbol,
        side: position.side,
        amount: position.amount,
        price: currentPrice,
        liquidationFee: this.calculateLiquidationFee(position, currentPrice),
        marginType: position.marginType,
        timestamp: new Date(),
      };

      // 添加到清算队列
      await this.addToLiquidationQueue(position, currentPrice);

      // 发送清算事件
      this.eventEmitter.emit('position.liquidation', liquidationEvent);

      // 更新指标
      this.prometheusService.incrementLiquidationCount(position.symbol);
      this.prometheusService.addLiquidationVolume(
        position.symbol,
        position.amount * currentPrice,
      );
    } catch (error) {
      this.logger.error(
        `Failed to trigger liquidation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async executeLiquidation(
    position: LiquidationPosition,
    symbol: string,
  ): Promise<void> {
    try {
      const currentPrice = await this.getCurrentPrice(symbol);
      const liquidationFee = position.amount * currentPrice * 0.005; // 0.5% 清算费率

      // 检查是否需要使用保险基金
      const loss = this.calculateLiquidationLoss(position, currentPrice);
      if (loss > 0) {
        await this.handleInsuranceFundOperation(symbol, loss, 'PAYOUT');
      }

      // 创建清算订单
      const liquidationOrder = {
        symbol,
        positionId: position.positionId,
        userId: position.userId,
        amount: position.amount,
        price: currentPrice,
        liquidationFee,
        timestamp: new Date(),
      };

      // 发送清算订单事件
      this.eventEmitter.emit('liquidation.order', liquidationOrder);

      // 更新统计数据
      await this.updateLiquidationStats(symbol, liquidationOrder);
    } catch (error) {
      this.logger.error(
        `Failed to execute liquidation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleInsuranceFundOperation(
    symbol: string,
    amount: number,
    type: 'INJECTION' | 'PAYOUT',
  ): Promise<void> {
    try {
      const operation: InsuranceFundOperation = {
        id: this.generateId(),
        symbol,
        type,
        amount,
        reason: type === 'INJECTION' ? 'System Injection' : 'Liquidation Loss',
        timestamp: new Date(),
      };

      // 更新保险基金余额
      const currentBalance = this.insuranceFundBalances.get(symbol) || 0;
      this.insuranceFundBalances.set(
        symbol,
        type === 'INJECTION' ? currentBalance + amount : currentBalance - amount,
      );

      // 保存操作记录
      await this.redisService.set(
        `insurance:operation:${operation.id}`,
        JSON.stringify(operation),
        0,
      );

      // 更新指标
      this.prometheusService.setInsuranceFundBalance(
        symbol,
        this.insuranceFundBalances.get(symbol) || 0,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle insurance fund operation: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async addToLiquidationQueue(
    position: Position,
    currentPrice: number,
  ): Promise<void> {
    try {
      const queue = this.getOrCreateLiquidationQueue(position.symbol, position.side);
      const liquidationPosition: LiquidationPosition = {
        positionId: position.id,
        userId: position.userId,
        amount: position.amount,
        margin: position.margin,
        marginRatio: position.marginRatio,
        bankruptcyPrice: this.calculateBankruptcyPrice(position),
        priority: this.calculateLiquidationPriority(position),
      };

      queue.positions.push(liquidationPosition);
      queue.lastUpdateTime = new Date();

      await this.saveLiquidationQueue(queue);
    } catch (error) {
      this.logger.error(
        `Failed to add to liquidation queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getOrCreateLiquidationQueue(
    symbol: string,
    side: PositionSide,
  ): LiquidationQueue {
    const key = `${symbol}:${side}`;
    if (!this.liquidationQueues.has(key)) {
      this.liquidationQueues.set(key, {
        symbol,
        side,
        positions: [],
        lastUpdateTime: new Date(),
      });
    }
    return this.liquidationQueues.get(key)!;
  }

  private async saveLiquidationQueue(queue: LiquidationQueue): Promise<void> {
    const key = `liquidation:queue:${queue.symbol}:${queue.side}`;
    await this.redisService.set(key, JSON.stringify(queue), 0);
  }

  private async initializeLiquidationQueues(): Promise<void> {
    try {
      const keys = await this.redisService.keys('liquidation:queue:*');
      for (const key of keys) {
        const queue = await this.redisService.get(key);
        if (queue) {
          const parsedQueue: LiquidationQueue = JSON.parse(queue);
          this.liquidationQueues.set(
            `${parsedQueue.symbol}:${parsedQueue.side}`,
            parsedQueue,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize liquidation queues: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateLiquidationStats(
    symbol: string,
    liquidationOrder: any,
  ): Promise<void> {
    try {
      const stats = await this.getLiquidationStats(symbol);
      const volume = liquidationOrder.amount * liquidationOrder.price;

      stats.totalLiquidations += 1;
      stats.totalLiquidationVolume += volume;
      stats.totalLiquidationFees += liquidationOrder.liquidationFee;

      await this.redisService.set(
        `liquidation:stats:${symbol}`,
        JSON.stringify(stats),
        0,
      );

      // 更新 Prometheus 指标
      this.prometheusService.setLiquidationStats(symbol, stats);
    } catch (error) {
      this.logger.error(
        `Failed to update liquidation stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private createEmptyStats(symbol: string): LiquidationStats {
    return {
      totalLiquidations: 0,
      totalLiquidationVolume: 0,
      totalLiquidationFees: 0,
      insuranceFundBalance: this.insuranceFundBalances.get(symbol) || 0,
      totalInsuranceFundInjections: 0,
      totalInsuranceFundPayouts: 0,
    };
  }

  private calculateUnrealizedPnl(
    position: Position,
    currentPrice: number,
  ): number {
    const priceDiff = currentPrice - position.entryPrice;
    return position.side === PositionSide.LONG
      ? position.amount * priceDiff
      : position.amount * -priceDiff;
  }

  private calculateLiquidationFee(
    position: Position,
    currentPrice: number,
  ): number {
    return position.amount * currentPrice * 0.005; // 0.5% 清算费率
  }

  private calculateBankruptcyPrice(position: Position): number {
    const liquidationPenalty = 0.005; // 0.5% 清算惩罚
    return position.side === PositionSide.LONG
      ? position.entryPrice * (1 - position.leverage * (1 - liquidationPenalty))
      : position.entryPrice * (1 + position.leverage * (1 - liquidationPenalty));
  }

  private calculateLiquidationPriority(position: Position): number {
    // 优先级基于保证金率、杠杆率和持仓规模
    return (
      (1 / position.marginRatio) * position.leverage * Math.log10(position.amount)
    );
  }

  private calculateLiquidationLoss(
    position: LiquidationPosition,
    currentPrice: number,
  ): number {
    return Math.max(0, position.margin - position.amount * currentPrice);
  }

  private getMaintenanceMarginRatio(symbol: string): number {
    return this.maintenanceMarginRatios.get(symbol) || 0.005; // 默认 0.5%
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const price = await this.redisService.get(`price:${symbol}`);
    if (!price) {
      throw new Error(`Price not found for symbol: ${symbol}`);
    }
    return parseFloat(price);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private subscribeToEvents(): void {
    // 监听价格更新事件
    this.eventEmitter.on(
      'price.updated',
      async ({ symbol, price }: { symbol: string; price: number }) => {
        try {
          // 处理清算队列
          await this.processLiquidationQueue(symbol);
        } catch (error) {
          this.logger.error(
            `Failed to handle price update event: ${error.message}`,
            error.stack,
          );
        }
      },
    );

    // 监听保险基金注入事件
    this.eventEmitter.on(
      'insurance.fund.injection',
      async ({ symbol, amount }: { symbol: string; amount: number }) => {
        try {
          await this.handleInsuranceFundOperation(symbol, amount, 'INJECTION');
        } catch (error) {
          this.logger.error(
            `Failed to handle insurance fund injection: ${error.message}`,
            error.stack,
          );
        }
      },
    );
  }
}
