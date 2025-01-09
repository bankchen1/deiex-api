import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import {
  PerpetualOrder,
  Position,
  PositionSide,
  MarginType,
  PerpetualOrderType,
  OrderStatus,
  PerpetualConfig,
  MarginLevel,
} from '../types/perpetual.types';
import { LiquidationService } from './liquidation.service';
import { FundingService } from './funding.service';
import { MarketDataService } from '../../market/services/market-data.service';

@Injectable()
export class PerpetualService {
  private readonly logger = new Logger(PerpetualService.name);
  private readonly configs: Map<string, PerpetualConfig> = new Map();
  private readonly marginLevels: Map<string, MarginLevel[]> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly liquidationService: LiquidationService,
    private readonly fundingService: FundingService,
    private readonly marketDataService: MarketDataService,
  ) {
    this.initializeConfigs();
  }

  private async initializeConfigs() {
    const perpetualPairs = await this.prisma.perpetualPair.findMany({
      where: { isActive: true },
    });

    for (const pair of perpetualPairs) {
      this.configs.set(pair.symbol, {
        symbol: pair.symbol,
        baseAsset: pair.baseAsset,
        quoteAsset: pair.quoteAsset,
        tickSize: pair.tickSize,
        lotSize: pair.lotSize,
        maxLeverage: pair.maxLeverage,
        maintMarginRatio: pair.maintMarginRatio,
        initialMarginRatio: pair.initialMarginRatio,
        maxPrice: pair.maxPrice,
        minPrice: pair.minPrice,
        maxQuantity: pair.maxQuantity,
        minQuantity: pair.minQuantity,
        fundingInterval: pair.fundingInterval,
        insuranceFundFactor: pair.insuranceFundFactor,
      });

      this.marginLevels.set(pair.symbol, pair.marginLevels);
    }
  }

  async createOrder(userId: string, orderData: Partial<PerpetualOrder>): Promise<PerpetualOrder> {
    const startTime = Date.now();
    try {
      // 验证订单参数
      this.validateOrderParams(orderData);

      // 检查用户余额和保证金
      await this.checkMarginRequirement(userId, orderData);

      // 创建订单
      const order = await this.prisma.$transaction(async (prisma) => {
        // 锁定保证金
        await this.lockMargin(prisma, userId, orderData);

        // 创建订单记录
        const newOrder = await prisma.perpetualOrder.create({
          data: {
            ...orderData,
            userId,
            status: OrderStatus.NEW,
            filled: 0,
            avgPrice: 0,
            fee: 0,
          },
        });

        // 如果是市价单，直接执行
        if (orderData.type === PerpetualOrderType.MARKET) {
          await this.executeOrder(prisma, newOrder);
        }

        return newOrder;
      });

      // 发送订单创建事件
      this.eventEmitter.emit('perpetual.order.created', order);

      // 记录性能指标
      this.prometheusService.recordLatency('perpetual_order_create', Date.now() - startTime);

      return order;
    } catch (error) {
      this.logger.error(`Failed to create perpetual order: ${error.message}`);
      this.prometheusService.incrementErrors('perpetual_order_create_error');
      throw error;
    }
  }

  async executeOrder(prisma: any, order: PerpetualOrder): Promise<void> {
    const position = await this.getOrCreatePosition(prisma, order.userId, order.symbol, order.side);
    const markPrice = await this.getMarkPrice(order.symbol);

    // 计算执行价格和数量
    const executionPrice = order.type === PerpetualOrderType.MARKET ? markPrice : order.price;
    const executionAmount = order.amount - order.filled;

    // 更新持仓
    await this.updatePosition(prisma, position, {
      price: executionPrice,
      amount: executionAmount,
      side: order.side,
    });

    // 更新订单状态
    await prisma.perpetualOrder.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.FILLED,
        filled: order.amount,
        avgPrice: executionPrice,
        updatedAt: new Date(),
      },
    });

    // 计算并收取手续费
    const fee = this.calculateFee(executionPrice, executionAmount);
    await this.chargeFee(prisma, order.userId, fee);

    // 检查是否需要清算
    await this.liquidationService.checkLiquidation(position.id);
  }

  private async getOrCreatePosition(
    prisma: any,
    userId: string,
    symbol: string,
    side: PositionSide,
  ): Promise<Position> {
    let position = await prisma.position.findFirst({
      where: {
        userId,
        symbol,
        side,
      },
    });

    if (!position) {
      position = await prisma.position.create({
        data: {
          userId,
          symbol,
          side,
          amount: 0,
          leverage: 1,
          marginType: MarginType.ISOLATED,
          entryPrice: 0,
          liquidationPrice: 0,
          bankruptcy: 0,
          margin: 0,
          unrealizedPnl: 0,
          realizedPnl: 0,
          maintMargin: 0,
          marginRatio: 0,
        },
      });
    }

    return position;
  }

  private async updatePosition(
    prisma: any,
    position: Position,
    update: { price: number; amount: number; side: PositionSide },
  ): Promise<void> {
    const { price, amount, side } = update;
    const config = this.configs.get(position.symbol);

    // 计算新的持仓数据
    const newAmount = position.amount + (side === position.side ? amount : -amount);
    const newEntryPrice = this.calculateNewEntryPrice(position, price, amount);
    const newLiquidationPrice = this.calculateLiquidationPrice(
      newEntryPrice,
      newAmount,
      position.leverage,
      side,
      config,
    );

    // 更新持仓
    await prisma.position.update({
      where: { id: position.id },
      data: {
        amount: newAmount,
        entryPrice: newEntryPrice,
        liquidationPrice: newLiquidationPrice,
        lastUpdateTime: new Date(),
      },
    });
  }

  private calculateNewEntryPrice(
    position: Position,
    price: number,
    amount: number,
  ): number {
    if (position.amount === 0) return price;
    return (position.entryPrice * position.amount + price * amount) / (position.amount + amount);
  }

  private calculateLiquidationPrice(
    entryPrice: number,
    amount: number,
    leverage: number,
    side: PositionSide,
    config: PerpetualConfig,
  ): number {
    const maintMargin = amount * entryPrice * config.maintMarginRatio;
    const direction = side === PositionSide.LONG ? 1 : -1;
    return entryPrice * (1 - direction * (1 / leverage - config.maintMarginRatio));
  }

  private async getMarkPrice(symbol: string): Promise<number> {
    const ticker = await this.marketDataService.getTickerData(symbol);
    return ticker.price;
  }

  private calculateFee(price: number, amount: number): number {
    const feeRate = this.configService.get('PERPETUAL_FEE_RATE', 0.0004);
    return price * amount * feeRate;
  }

  private async chargeFee(prisma: any, userId: string, fee: number): Promise<void> {
    await prisma.userBalance.update({
      where: { userId },
      data: {
        balance: {
          decrement: fee,
        },
      },
    });
  }

  // 公共API方法
  async getPosition(userId: string, symbol: string): Promise<Position> {
    return await this.prisma.position.findFirst({
      where: {
        userId,
        symbol,
      },
    });
  }

  async getOpenOrders(userId: string, symbol?: string): Promise<PerpetualOrder[]> {
    return await this.prisma.perpetualOrder.findMany({
      where: {
        userId,
        symbol,
        status: {
          in: [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED],
        },
      },
    });
  }

  async cancelOrder(userId: string, orderId: string): Promise<PerpetualOrder> {
    return await this.prisma.$transaction(async (prisma) => {
      const order = await prisma.perpetualOrder.findFirst({
        where: {
          id: orderId,
          userId,
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== OrderStatus.NEW && order.status !== OrderStatus.PARTIALLY_FILLED) {
        throw new Error('Order cannot be canceled');
      }

      // 解锁保证金
      await this.unlockMargin(prisma, userId, order);

      // 更新订单状态
      return await prisma.perpetualOrder.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELED,
          updatedAt: new Date(),
        },
      });
    });
  }

  async adjustLeverage(
    userId: string,
    symbol: string,
    leverage: number,
  ): Promise<Position> {
    const config = this.configs.get(symbol);
    if (!config) {
      throw new Error('Invalid symbol');
    }

    if (leverage > config.maxLeverage) {
      throw new Error(`Maximum leverage is ${config.maxLeverage}`);
    }

    return await this.prisma.$transaction(async (prisma) => {
      const position = await prisma.position.findFirst({
        where: {
          userId,
          symbol,
        },
      });

      if (!position) {
        throw new Error('Position not found');
      }

      // 检查新的杠杆率是否会导致立即清算
      const newLiquidationPrice = this.calculateLiquidationPrice(
        position.entryPrice,
        position.amount,
        leverage,
        position.side,
        config,
      );

      const markPrice = await this.getMarkPrice(symbol);
      if (
        (position.side === PositionSide.LONG && markPrice <= newLiquidationPrice) ||
        (position.side === PositionSide.SHORT && markPrice >= newLiquidationPrice)
      ) {
        throw new Error('New leverage would cause immediate liquidation');
      }

      return await prisma.position.update({
        where: { id: position.id },
        data: {
          leverage,
          liquidationPrice: newLiquidationPrice,
          lastUpdateTime: new Date(),
        },
      });
    });
  }
}
