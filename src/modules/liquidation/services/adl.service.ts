import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../../shared/services/prometheus.service';
import {
  ADLEvent,
  ADLQueue,
  ADLPosition,
  ADLStatus,
  ADLStats,
} from '../types/liquidation.types';
import { Position, PositionSide } from '../../perpetual/types/perpetual.types';

@Injectable()
export class ADLService {
  private readonly logger = new Logger(ADLService.name);
  private readonly adlQueues = new Map<string, ADLQueue>();
  private readonly adlThresholds = new Map<string, number>();

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
      // 初始化 ADL 阈值
      const thresholds = this.configService.get<Record<string, number>>(
        'perpetual.adlThresholds',
      );
      if (thresholds) {
        Object.entries(thresholds).forEach(([symbol, threshold]) => {
          this.adlThresholds.set(symbol, threshold);
        });
      }

      // 初始化 ADL 队列
      await this.initializeADLQueues();

      this.logger.log('ADL service initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize ADL service: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkPositionADL(position: Position): Promise<boolean> {
    try {
      const currentPrice = await this.getCurrentPrice(position.symbol);
      const unrealizedPnl = this.calculateUnrealizedPnl(position, currentPrice);
      const roe = unrealizedPnl / position.margin; // Return on Equity

      // 如果 ROE 超过阈值，添加到 ADL 队列
      const threshold = this.getADLThreshold(position.symbol);
      if (roe > threshold) {
        await this.addToADLQueue(position, roe);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check position ADL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async processADLQueue(symbol: string): Promise<void> {
    try {
      const queue = this.adlQueues.get(symbol);
      if (!queue || queue.positions.length === 0) {
        return;
      }

      // 按优先级排序（ROE 最高的优先）
      queue.positions.sort((a, b) => b.priority - a.priority);

      for (const position of queue.positions) {
        try {
          await this.executeADL(position, symbol);
        } catch (error) {
          this.logger.error(
            `Failed to execute ADL for position ${position.positionId}: ${error.message}`,
            error.stack,
          );
        }
      }

      // 更新队列
      queue.positions = [];
      queue.lastUpdateTime = new Date();
      await this.saveADLQueue(queue);
    } catch (error) {
      this.logger.error(
        `Failed to process ADL queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getADLStats(symbol: string): Promise<ADLStats> {
    try {
      const stats = await this.redisService.get(`adl:stats:${symbol}`);
      return stats ? JSON.parse(stats) : this.createEmptyStats(symbol);
    } catch (error) {
      this.logger.error(
        `Failed to get ADL stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async executeADL(position: ADLPosition, symbol: string): Promise<void> {
    try {
      const currentPrice = await this.getCurrentPrice(symbol);
      const adlFee = position.size * currentPrice * 0.001; // 0.1% ADL 费率

      // 创建 ADL 事件
      const adlEvent: ADLEvent = {
        userId: position.userId,
        positionId: position.positionId,
        symbol,
        side: position.side,
        size: position.size,
        price: currentPrice,
        adlFee,
        marginType: position.marginType,
        timestamp: new Date(),
      };

      // 发送 ADL 事件
      this.eventEmitter.emit('position.adl', adlEvent);

      // 更新统计数据
      await this.updateADLStats(symbol, adlEvent);

      // 更新指标
      this.prometheusService.incrementADLCount(symbol);
      this.prometheusService.addADLVolume(symbol, position.size * currentPrice);
    } catch (error) {
      this.logger.error(
        `Failed to execute ADL: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async addToADLQueue(position: Position, roe: number): Promise<void> {
    try {
      const queue = this.getOrCreateADLQueue(position.symbol, position.side);
      const adlPosition: ADLPosition = {
        positionId: position.id,
        userId: position.userId,
        size: position.amount,
        unrealizedPnl: position.unrealizedPnl,
        roe,
        priority: this.calculateADLPriority(position, roe),
        side: position.side,
        marginType: position.marginType,
      };

      queue.positions.push(adlPosition);
      queue.lastUpdateTime = new Date();

      await this.saveADLQueue(queue);
    } catch (error) {
      this.logger.error(
        `Failed to add to ADL queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getOrCreateADLQueue(
    symbol: string,
    side: PositionSide,
  ): ADLQueue {
    const key = `${symbol}:${side}`;
    if (!this.adlQueues.has(key)) {
      this.adlQueues.set(key, {
        symbol,
        side,
        positions: [],
        lastUpdateTime: new Date(),
      });
    }
    return this.adlQueues.get(key)!;
  }

  private async saveADLQueue(queue: ADLQueue): Promise<void> {
    const key = `adl:queue:${queue.symbol}:${queue.side}`;
    await this.redisService.set(key, JSON.stringify(queue), 0);
  }

  private async initializeADLQueues(): Promise<void> {
    try {
      const keys = await this.redisService.keys('adl:queue:*');
      for (const key of keys) {
        const queue = await this.redisService.get(key);
        if (queue) {
          const parsedQueue: ADLQueue = JSON.parse(queue);
          this.adlQueues.set(
            `${parsedQueue.symbol}:${parsedQueue.side}`,
            parsedQueue,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize ADL queues: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateADLStats(symbol: string, adlEvent: ADLEvent): Promise<void> {
    try {
      const stats = await this.getADLStats(symbol);
      const volume = adlEvent.size * adlEvent.price;

      stats.totalADLs += 1;
      stats.totalADLVolume += volume;
      stats.totalADLFees += adlEvent.adlFee;
      stats.averageADLPrice =
        (stats.averageADLPrice * (stats.totalADLs - 1) + adlEvent.price) /
        stats.totalADLs;

      await this.redisService.set(
        `adl:stats:${symbol}`,
        JSON.stringify(stats),
        0,
      );

      // 更新 Prometheus 指标
      this.prometheusService.setADLStats(symbol, stats);
    } catch (error) {
      this.logger.error(
        `Failed to update ADL stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private createEmptyStats(symbol: string): ADLStats {
    return {
      totalADLs: 0,
      totalADLVolume: 0,
      totalADLFees: 0,
      averageADLPrice: 0,
      mostADLedSymbol: symbol,
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

  private calculateADLPriority(position: Position, roe: number): number {
    // 优先级基于 ROE、杠杆率和持仓规模
    return roe * position.leverage * Math.log10(position.amount);
  }

  private getADLThreshold(symbol: string): number {
    return this.adlThresholds.get(symbol) || 0.1; // 默认 10% ROE
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const price = await this.redisService.get(`price:${symbol}`);
    if (!price) {
      throw new Error(`Price not found for symbol: ${symbol}`);
    }
    return parseFloat(price);
  }

  private subscribeToEvents(): void {
    // 监听价格更新事件
    this.eventEmitter.on(
      'price.updated',
      async ({ symbol, price }: { symbol: string; price: number }) => {
        try {
          // 处理 ADL 队列
          await this.processADLQueue(symbol);
        } catch (error) {
          this.logger.error(
            `Failed to handle price update event: ${error.message}`,
            error.stack,
          );
        }
      },
    );

    // 监听清算事件
    this.eventEmitter.on(
      'position.liquidation',
      async (event: { symbol: string; side: PositionSide }) => {
        try {
          // 当有清算发生时，检查是否需要触发 ADL
          await this.processADLQueue(event.symbol);
        } catch (error) {
          this.logger.error(
            `Failed to handle liquidation event: ${error.message}`,
            error.stack,
          );
        }
      },
    );
  }
}
