import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { Position, PositionSide } from '../types/perpetual.types';
import { MarketDataService } from '../../market/services/market-data.service';

interface ADLInfo {
  positionId: string;
  userId: string;
  symbol: string;
  side: PositionSide;
  amount: number;
  pnlRatio: number;
  score: number;
}

@Injectable()
export class ADLService {
  private readonly logger = new Logger(ADLService.name);
  private readonly ADL_QUEUE_PREFIX = 'adl:queue:';
  private readonly ADL_LOCK_TTL = 60; // 60 seconds

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly marketDataService: MarketDataService,
  ) {
    this.startADLWorker();
  }

  private async startADLWorker() {
    while (true) {
      try {
        // 检查所有交易对的ADL队列
        const pairs = await this.prisma.perpetualPair.findMany({
          where: { isActive: true },
        });

        for (const pair of pairs) {
          await this.processADLQueue(pair.symbol);
        }

        // 等待一段时间再继续
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.logger.error(`ADL worker error: ${error.message}`);
        this.prometheusService.incrementErrors('adl_worker_error');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processADLQueue(symbol: string) {
    const queueKey = `${this.ADL_QUEUE_PREFIX}${symbol}`;
    const lockKey = `${queueKey}:lock`;

    // 获取锁
    const locked = await this.redis.set(lockKey, '1', 'NX', 'EX', this.ADL_LOCK_TTL);
    if (!locked) return;

    try {
      // 检查保险基金状态
      const insuranceFund = await this.prisma.insuranceFund.findUnique({
        where: { symbol },
      });

      if (!insuranceFund || insuranceFund.balance > 0) {
        return; // 保险基金充足，不需要ADL
      }

      // 获取需要进行ADL的头寸
      const positions = await this.getADLPositions(symbol);
      if (positions.length === 0) return;

      // 按得分排序，选择得分最高的头寸进行ADL
      const targetPosition = positions[0];

      // 执行ADL
      await this.executeADL(targetPosition);

    } finally {
      // 释放锁
      await this.redis.del(lockKey);
    }
  }

  private async getADLPositions(symbol: string): Promise<ADLInfo[]> {
    const positions = await this.prisma.position.findMany({
      where: {
        symbol,
        amount: { gt: 0 },
      },
    });

    const markPrice = await this.marketDataService.getTickerData(symbol);

    const adlInfos: ADLInfo[] = [];
    for (const position of positions) {
      const pnlRatio = this.calculatePnLRatio(position, markPrice.price);
      const score = this.calculateADLScore(position, pnlRatio);

      adlInfos.push({
        positionId: position.id,
        userId: position.userId,
        symbol: position.symbol,
        side: position.side,
        amount: position.amount,
        pnlRatio,
        score,
      });
    }

    // 按得分降序排序
    return adlInfos.sort((a, b) => b.score - a.score);
  }

  private calculatePnLRatio(position: Position, markPrice: number): number {
    const unrealizedPnl = position.side === PositionSide.LONG
      ? (markPrice - position.entryPrice) * position.amount
      : (position.entryPrice - markPrice) * position.amount;

    return unrealizedPnl / (position.margin || 1);
  }

  private calculateADLScore(position: Position, pnlRatio: number): number {
    // 计算ADL得分，考虑以下因素：
    // 1. 盈亏比率（权重：0.4）
    // 2. 持仓规模（权重：0.3）
    // 3. 杠杆率（权重：0.3）
    
    const pnlScore = Math.max(0, pnlRatio) * 0.4;
    const sizeScore = (position.amount / 1000) * 0.3; // 假设1000是基准规模
    const leverageScore = (position.leverage / 100) * 0.3;

    return pnlScore + sizeScore + leverageScore;
  }

  private async executeADL(targetPosition: ADLInfo) {
    const startTime = Date.now();
    
    try {
      await this.prisma.$transaction(async (prisma) => {
        // 获取当前市场价格
        const markPrice = await this.marketDataService.getTickerData(targetPosition.symbol);

        // 计算需要减仓的数量（这里假设减仓20%）
        const deleverageAmount = targetPosition.amount * 0.2;

        // 创建ADL订单
        const adlOrder = await prisma.adlOrder.create({
          data: {
            positionId: targetPosition.positionId,
            userId: targetPosition.userId,
            symbol: targetPosition.symbol,
            side: targetPosition.side === PositionSide.LONG ? PositionSide.SHORT : PositionSide.LONG,
            amount: deleverageAmount,
            price: markPrice.price,
            timestamp: new Date(),
          },
        });

        // 更新持仓
        await prisma.position.update({
          where: { id: targetPosition.positionId },
          data: {
            amount: {
              decrement: deleverageAmount,
            },
            margin: {
              decrement: (targetPosition.amount / deleverageAmount) * targetPosition.margin,
            },
            lastUpdateTime: new Date(),
          },
        });

        // 发送ADL事件
        this.eventEmitter.emit('position.adl.executed', {
          position: targetPosition,
          adlOrder,
          markPrice: markPrice.price,
        });
      });

      // 记录性能指标
      this.prometheusService.recordLatency('adl_execution', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`ADL execution error: ${error.message}`);
      this.prometheusService.incrementErrors('adl_execution_error');
      throw error;
    }
  }

  // 公共API方法
  async getADLIndicator(positionId: string): Promise<{
    indicator: number; // 0-5, 0表示安全，5表示最高风险
    nextCheckTime: number;
  }> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    const markPrice = await this.marketDataService.getTickerData(position.symbol);
    const pnlRatio = this.calculatePnLRatio(position, markPrice.price);
    const score = this.calculateADLScore(position, pnlRatio);

    // 将得分转换为0-5的指标
    const indicator = Math.min(5, Math.floor(score * 10));

    return {
      indicator,
      nextCheckTime: Date.now() + 60000, // 1分钟后再次检查
    };
  }

  async getADLHistory(
    userId: string,
    symbol?: string,
    limit: number = 100,
  ) {
    return await this.prisma.adlOrder.findMany({
      where: {
        userId,
        symbol,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }
}
