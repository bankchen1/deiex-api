import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { Position, PositionSide, LiquidationOrder } from '../types/perpetual.types';
import { MarketDataService } from '../../market/services/market-data.service';

@Injectable()
export class LiquidationService {
  private readonly logger = new Logger(LiquidationService.name);
  private readonly LIQUIDATION_QUEUE = 'liquidation:queue';
  private readonly LIQUIDATION_LOCK_TTL = 60; // 60 seconds

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly marketDataService: MarketDataService,
  ) {
    this.startLiquidationWorker();
  }

  private async startLiquidationWorker() {
    while (true) {
      try {
        // 从队列中获取待清算的持仓
        const positionId = await this.redis.brpop(this.LIQUIDATION_QUEUE, 0);
        
        if (positionId) {
          const lockKey = `liquidation:lock:${positionId[1]}`;
          const locked = await this.redis.set(lockKey, '1', 'NX', 'EX', this.LIQUIDATION_LOCK_TTL);
          
          if (locked) {
            await this.processLiquidation(positionId[1]);
            await this.redis.del(lockKey);
          }
        }
      } catch (error) {
        this.logger.error(`Liquidation worker error: ${error.message}`);
        this.prometheusService.incrementErrors('liquidation_worker_error');
        // 等待一段时间后继续
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async checkLiquidation(positionId: string): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    const markPrice = await this.marketDataService.getTickerData(position.symbol);
    const shouldLiquidate = this.shouldLiquidatePosition(position, markPrice.price);

    if (shouldLiquidate) {
      // 添加到清算队列
      await this.redis.lpush(this.LIQUIDATION_QUEUE, positionId);
      
      // 发送清算警告事件
      this.eventEmitter.emit('position.liquidation.warning', {
        positionId,
        userId: position.userId,
        symbol: position.symbol,
        markPrice: markPrice.price,
      });
    }
  }

  private shouldLiquidatePosition(position: Position, markPrice: number): boolean {
    if (position.amount === 0) return false;

    if (position.side === PositionSide.LONG) {
      return markPrice <= position.liquidationPrice;
    } else {
      return markPrice >= position.liquidationPrice;
    }
  }

  private async processLiquidation(positionId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.prisma.$transaction(async (prisma) => {
        // 获取持仓信息
        const position = await prisma.position.findUnique({
          where: { id: positionId },
        });

        if (!position) {
          throw new Error('Position not found');
        }

        // 获取当前市场价格
        const markPrice = await this.marketDataService.getTickerData(position.symbol);

        // 如果不需要清算，直接返回
        if (!this.shouldLiquidatePosition(position, markPrice.price)) {
          return;
        }

        // 计算清算费用
        const liquidationFee = this.calculateLiquidationFee(position, markPrice.price);

        // 创建清算订单
        const liquidationOrder = await prisma.liquidationOrder.create({
          data: {
            positionId: position.id,
            userId: position.userId,
            symbol: position.symbol,
            side: position.side === PositionSide.LONG ? PositionSide.SHORT : PositionSide.LONG,
            amount: position.amount,
            price: markPrice.price,
            liquidationFee,
          },
        });

        // 更新用户余额
        await prisma.userBalance.update({
          where: { userId: position.userId },
          data: {
            balance: {
              decrement: liquidationFee,
            },
          },
        });

        // 更新保险基金
        await prisma.insuranceFund.update({
          where: { symbol: position.symbol },
          data: {
            balance: {
              increment: liquidationFee,
            },
            totalPayouts: {
              increment: liquidationFee,
            },
          },
        });

        // 关闭持仓
        await prisma.position.update({
          where: { id: position.id },
          data: {
            amount: 0,
            margin: 0,
            unrealizedPnl: 0,
            realizedPnl: position.realizedPnl - liquidationFee,
            lastUpdateTime: new Date(),
          },
        });

        // 发送清算完成事件
        this.eventEmitter.emit('position.liquidated', {
          position,
          liquidationOrder,
          markPrice: markPrice.price,
        });
      });

      // 记录性能指标
      this.prometheusService.recordLatency('liquidation_process', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Liquidation processing error: ${error.message}`);
      this.prometheusService.incrementErrors('liquidation_process_error');
      throw error;
    }
  }

  private calculateLiquidationFee(position: Position, markPrice: number): number {
    const positionValue = position.amount * markPrice;
    const feeRate = this.configService.get('LIQUIDATION_FEE_RATE', 0.005); // 0.5%
    return positionValue * feeRate;
  }

  // 公共API方法
  async getLiquidationHistory(
    userId: string,
    symbol?: string,
    limit: number = 100,
  ): Promise<LiquidationOrder[]> {
    return await this.prisma.liquidationOrder.findMany({
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

  async getLiquidationRisk(positionId: string): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    marginRatio: number;
    liquidationPrice: number;
    currentPrice: number;
  }> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new Error('Position not found');
    }

    const markPrice = await this.marketDataService.getTickerData(position.symbol);
    const marginRatio = position.marginRatio;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (marginRatio < 0.1) {
      riskLevel = 'HIGH';
    } else if (marginRatio < 0.2) {
      riskLevel = 'MEDIUM';
    }

    return {
      riskLevel,
      marginRatio,
      liquidationPrice: position.liquidationPrice,
      currentPrice: markPrice.price,
    };
  }
}
