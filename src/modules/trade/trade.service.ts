import { Injectable, BadRequestException, Logger, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssetService } from '../asset/asset.service';
import { RiskService } from '../risk/risk.service';
import { PrometheusService } from '../prometheus/prometheus.service';
import { OrderMatchingEngine } from './engines/order-matching.engine';
import { 
  OrderSide, 
  OrderType, 
  OrderStatus, 
  Order, 
  Trade, 
  Position, 
  TradingPair,
  TradeCreateData,
  OrderCreateData,
  PositionCreateData,
  OrderUpdateData,
  PositionUpdateData,
  TradeUpdateData,
} from './types/trade.types';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import {
  CreateOrderDto,
  OrderResponseDto,
  TradeResponseDto,
  TradeQueryDto,
  TradeHistoryDto,
  TradeStatisticsDto,
  UpdatePositionDto,
  PositionResponseDto,
} from './dto/trade.dto';

type PrismaTradeInclude = {
  user: true;
};

type PrismaOrderInclude = {
  user: true;
  position: true;
};

type PrismaPositionInclude = {
  user: true;
  orders: true;
};

type PrismaTrade = Prisma.TradeGetPayload<{
  include: PrismaTradeInclude;
}>;

type PrismaOrder = Prisma.OrderGetPayload<{
  include: PrismaOrderInclude;
}>;

type PrismaPosition = Prisma.PositionGetPayload<{
  include: PrismaPositionInclude;
}>;

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  private readonly matchingEngines = new Map<string, OrderMatchingEngine>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly assetService: AssetService,
    private readonly riskService: RiskService,
    private readonly prometheusService: PrometheusService,
  ) {}

  async onModuleInit() {
    await this.initializeMatchingEngines();
  }

  private async initializeMatchingEngines() {
    try {
      // 从配置或数据库获取交易对列表
      const tradingPairs: TradingPair[] = [
        { symbol: 'BTC-USDT', baseAsset: 'BTC', quoteAsset: 'USDT', isActive: true },
        { symbol: 'ETH-USDT', baseAsset: 'ETH', quoteAsset: 'USDT', isActive: true },
      ];

      for (const pair of tradingPairs) {
        if (pair.isActive) {
          const engine = new OrderMatchingEngine(pair.symbol);
          await this.loadExistingOrders(engine, pair.symbol);
          this.matchingEngines.set(pair.symbol, engine);
        }
      }

      this.logger.log(`Initialized matching engines for ${tradingPairs.filter(p => p.isActive).length} trading pairs`);
    } catch (error) {
      this.logger.error('Failed to initialize matching engines:', error);
      throw error;
    }
  }

  private async loadExistingOrders(engine: OrderMatchingEngine, symbol: string) {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        symbol,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const order of activeOrders) {
      engine.addOrder({
        id: order.id,
        userId: order.userId,
        symbol: order.symbol,
        side: order.side as OrderSide,
        type: order.type as OrderType,
        price: order.price,
        quantity: order.quantity,
        leverage: order.leverage,
        margin: order.margin,
        timeInForce: order.timeInForce,
        status: order.status as OrderStatus,
        filledQty: order.filledQty,
        remainingQty: order.remainingQty,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        positionId: order.positionId,
      });
    }
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    const engine = this.matchingEngines.get(createOrderDto.symbol);
    if (!engine) {
      throw new BadRequestException('Trading pair not found');
    }

    // 风险检查
    const isRiskValid = await this.riskService.checkOrderRisk(
      userId,
      createOrderDto.symbol,
      createOrderDto.side,
      createOrderDto.quantity,
      createOrderDto.leverage || 1,
      createOrderDto.price,
    );

    if (!isRiskValid) {
      throw new BadRequestException('Order exceeds risk limits');
    }

    // 计算所需保证金
    const margin = this.calculateRequiredMargin(
      createOrderDto.price,
      createOrderDto.quantity,
      createOrderDto.leverage || 1,
    );

    // 检查用户余额
    const [baseAsset, quoteAsset] = this.getAssetPair(createOrderDto.symbol);
    
    if (createOrderDto.side === OrderSide.BUY) {
      const balance = await this.assetService.getUserBalance(userId, quoteAsset);
      if (parseFloat(balance.available) < parseFloat(margin)) {
        throw new BadRequestException('Insufficient margin');
      }
    } else {
      const balance = await this.assetService.getUserBalance(userId, baseAsset);
      if (parseFloat(balance.available) < parseFloat(createOrderDto.quantity)) {
        throw new BadRequestException('Insufficient balance');
      }
    }

    // 创建订单
    const order = await this.prisma.$transaction(async (prisma) => {
      // 创建订单记录
      const order = await prisma.order.create({
        data: {
          id: uuidv4(),
          userId,
          symbol: createOrderDto.symbol,
          side: createOrderDto.side,
          type: createOrderDto.type,
          price: createOrderDto.price,
          quantity: createOrderDto.quantity,
          filledQty: '0',
          status: OrderStatus.PENDING,
          leverage: createOrderDto.leverage,
          margin,
          timeInForce: createOrderDto.timeInForce,
        },
      });

      // 冻结保证金
      await this.assetService.freezeBalance(
        userId,
        createOrderDto.side === OrderSide.BUY ? quoteAsset : baseAsset,
        margin,
      );

      return order;
    });

    // 处理订单匹配
    const matchResult = await engine.processOrder({
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      side: order.side as OrderSide,
      type: order.type as OrderType,
      price: order.price,
      quantity: order.quantity,
      leverage: order.leverage,
      margin: order.margin,
      timeInForce: order.timeInForce,
      status: order.status as OrderStatus,
      filledQty: order.filledQty,
      remainingQty: order.remainingQty,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      positionId: order.positionId,
    });

    // 处理交易
    if (matchResult.trades.length > 0) {
      await this.processTrades(matchResult.trades);
    }

    // 发送事件
    this.eventEmitter.emit('order.created', this.mapOrderToResponse(order));
    this.eventEmitter.emit('orderbook.updated', {
      symbol: order.symbol,
      data: engine.getOrderBookSnapshot(),
    });

    return this.mapOrderToResponse(order);
  }

  async cancelOrder(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new BadRequestException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PARTIALLY_FILLED) {
      throw new BadRequestException('Order cannot be canceled');
    }

    const engine = this.matchingEngines.get(order.symbol);
    if (!engine) {
      throw new BadRequestException('Trading pair not found');
    }

    // 从匹配引擎中移除订单
    engine.cancelOrder(orderId);

    // 更新订单状态并解冻保证金
    const canceledOrder = await this.prisma.$transaction(async (prisma) => {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      // 解冻未使用的保证金
      const [baseAsset, quoteAsset] = this.getAssetPair(order.symbol);
      const remainingMargin = (
        parseFloat(order.margin) * 
        (parseFloat(order.quantity) - parseFloat(order.filledQty)) / 
        parseFloat(order.quantity)
      ).toString();
      
      await this.assetService.unfreezeBalance(
        userId,
        order.side === OrderSide.BUY ? quoteAsset : baseAsset,
        remainingMargin
      );

      return updatedOrder;
    });

    // 发送事件
    this.eventEmitter.emit('order.canceled', this.mapOrderToResponse(canceledOrder));
    this.eventEmitter.emit('orderbook.updated', {
      symbol: order.symbol,
      data: engine.getOrderBookSnapshot(),
    });

    return this.mapOrderToResponse(canceledOrder);
  }

  async getOrderBook(symbol: string, limit: number = 100): Promise<{ bids: any[]; asks: any[] }> {
    const engine = this.matchingEngines.get(symbol);
    if (!engine) {
      throw new BadRequestException('Trading pair not found');
    }

    return engine.getOrderBookSnapshot();
  }

  async getUserOrders(userId: string, symbol?: string): Promise<OrderResponseDto[]> {
    const where: any = { userId };
    if (symbol) {
      where.symbol = symbol;
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => this.mapOrderToResponse(order));
  }

  async getUserTrades(userId: string, query: TradeQueryDto): Promise<TradeHistoryDto> {
    const where: any = {
      OR: [
        { userId },
        { makerUserId: userId },
        { takerUserId: userId },
      ],
    };

    if (query.symbol) where.symbol = query.symbol;
    if (query.orderId) {
      where.OR = [
        { makerOrderId: query.orderId },
        { takerOrderId: query.orderId },
      ];
    }
    if (query.startTime || query.endTime) {
      where.createdAt = {};
      if (query.startTime) where.createdAt.gte = new Date(query.startTime);
      if (query.endTime) where.createdAt.lte = new Date(query.endTime);
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.trade.count({ where }),
    ]);

    return {
      trades: trades.map(trade => this.mapTradeToResponse(trade)),
      total,
      page,
      limit,
    };
  }

  async getTradeStatistics(symbol: string): Promise<TradeStatisticsDto> {
    const cacheKey = `trade:statistics:${symbol}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const [trades, lastTrade] = await Promise.all([
      this.prisma.trade.findMany({
        where: {
          symbol,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时内
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.trade.findFirst({
        where: { symbol },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!trades.length || !lastTrade) {
      throw new BadRequestException('No trades found');
    }

    const firstPrice = parseFloat(trades[trades.length - 1].price);
    const lastPrice = parseFloat(lastTrade.price);
    const volume = trades.reduce((sum, trade) => sum + parseFloat(trade.amount), 0);
    const high = Math.max(...trades.map(trade => parseFloat(trade.price)));
    const low = Math.min(...trades.map(trade => parseFloat(trade.price)));
    const change = lastPrice - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    const statistics: TradeStatisticsDto = {
      symbol,
      price: lastPrice,
      volume,
      high,
      low,
      change,
      changePercent,
    };

    await this.redis.set(cacheKey, JSON.stringify(statistics), 'EX', 60); // 缓存1分钟

    return statistics;
  }

  async getUserPositions(userId: string, symbol?: string): Promise<PositionResponseDto[]> {
    const where: any = { userId };
    if (symbol) {
      where.symbol = symbol;
    }

    const positions = await this.prisma.position.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return positions.map(position => this.mapPositionToResponse(position));
  }

  async updatePosition(
    userId: string,
    positionId: string,
    updateDto: UpdatePositionDto,
  ): Promise<PositionResponseDto> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position || position.userId !== userId) {
      throw new NotFoundException('Position not found');
    }

    const minMargin = this.calculateMinMargin(position);
    const maxRemovable = parseFloat(position.margin) - minMargin;

    if (updateDto.removeMargin && updateDto.removeMargin > maxRemovable) {
      throw new BadRequestException('Cannot remove more than available margin');
    }

    const [baseAsset] = this.getAssetPair(position.symbol);

    if (updateDto.removeMargin) {
      await this.assetService.unfreezeBalance(userId, baseAsset, updateDto.removeMargin.toString());
    }

    const updatedPosition = await this.prisma.position.update({
      where: { id: positionId },
      data: {
        margin: updateDto.removeMargin 
          ? (parseFloat(position.margin) - updateDto.removeMargin).toString()
          : position.margin,
        liquidationPrice: this.calculateLiquidationPrice({
          ...position,
          margin: parseFloat(position.margin) - (updateDto.removeMargin || 0),
        }).toString(),
      },
    });

    return this.mapPositionToResponse(updatedPosition);
  }

  async getTradeDetail(userId: string, tradeId: string): Promise<TradeResponseDto> {
    const trade = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        OR: [
          { makerUserId: userId },
          { takerUserId: userId },
        ],
      },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    return this.mapTradeToResponse(trade);
  }

  async closeTrade(userId: string, tradeId: string): Promise<TradeResponseDto> {
    const tradeResult = await this.prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId,
      },
      select: {
        id: true,
        userId: true,
        symbol: true,
        side: true,
        amount: true,
        price: true,
        profitPercent: true,
        pnl: true,
        fee: true,
        makerOrderId: true,
        takerOrderId: true,
        makerUserId: true,
        takerUserId: true,
        createdAt: true,
        updatedAt: true,
        user: true,
      },
    });

    if (!tradeResult) {
      throw new NotFoundException('Trade not found');
    }

    const trade: Trade = {
      id: tradeResult.id,
      userId: tradeResult.userId,
      symbol: tradeResult.symbol,
      side: tradeResult.side as OrderSide,
      amount: tradeResult.amount,
      price: tradeResult.price,
      profitPercent: tradeResult.profitPercent || 0,
      pnl: tradeResult.pnl || '0',
      fee: tradeResult.fee || '0',
      makerOrderId: tradeResult.makerOrderId,
      takerOrderId: tradeResult.takerOrderId,
      makerUserId: tradeResult.makerUserId,
      takerUserId: tradeResult.takerUserId,
      createdAt: tradeResult.createdAt,
      updatedAt: tradeResult.updatedAt,
    };

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: trade.makerOrderId },
          { id: trade.takerOrderId },
        ],
        userId,
      },
      select: {
        id: true,
        userId: true,
        symbol: true,
        side: true,
        type: true,
        price: true,
        quantity: true,
        leverage: true,
        margin: true,
        timeInForce: true,
        status: true,
        filledQty: true,
        remainingQty: true,
        createdAt: true,
        updatedAt: true,
        positionId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const position = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol: trade.symbol,
        side: order.side,
      },
      select: {
        id: true,
        userId: true,
        symbol: true,
        side: true,
        quantity: true,
        entryPrice: true,
        leverage: true,
        liquidationPrice: true,
        margin: true,
        unrealizedPnl: true,
        realizedPnl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!position) {
      throw new NotFoundException('Position not found');
    }

    const params = {
      side: order.side as OrderSide,
      entryPrice: position.entryPrice,
      margin: Number(position.margin),
      leverage: position.leverage,
    };

    const pnl = this.calculateUnrealizedPnl(
      params.side,
      position.quantity,
      position.entryPrice,
      trade.price,
    );

    const updatedTradeResult = await this.prisma.$transaction(async (prisma) => {
      await prisma.position.update({
        where: { id: position.id },
        data: {
          quantity: '0',
          unrealizedPnl: '0',
          realizedPnl: (Number(position.realizedPnl) + Number(pnl)).toString(),
        },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.FILLED,
          updatedAt: new Date(),
        },
      });

      const updatedTradeResult = await prisma.trade.update({
        where: { id: tradeId },
        data: {
          pnl: pnl.toString(),
          profitPercent: Number(pnl) / Number(position.margin) * 100,
        },
        select: {
          id: true,
          userId: true,
          symbol: true,
          side: true,
          amount: true,
          price: true,
          profitPercent: true,
          pnl: true,
          fee: true,
          makerOrderId: true,
          takerOrderId: true,
          makerUserId: true,
          takerUserId: true,
          createdAt: true,
          updatedAt: true,
          user: true,
        },
      });

      const [baseAsset, quoteAsset] = this.getAssetPair(trade.symbol);
      await this.assetService.unfreezeBalance(
        userId,
        order.side === OrderSide.BUY ? quoteAsset : baseAsset,
        (Number(position.margin) + Number(pnl)).toString(),
      );

      return updatedTradeResult;
    });

    const updatedTrade: Trade = {
      id: updatedTradeResult.id,
      userId: updatedTradeResult.userId,
      symbol: updatedTradeResult.symbol,
      side: updatedTradeResult.side as OrderSide,
      amount: updatedTradeResult.amount,
      price: updatedTradeResult.price,
      profitPercent: updatedTradeResult.profitPercent || 0,
      pnl: updatedTradeResult.pnl || '0',
      fee: updatedTradeResult.fee || '0',
      makerOrderId: updatedTradeResult.makerOrderId,
      takerOrderId: updatedTradeResult.takerOrderId,
      makerUserId: updatedTradeResult.makerUserId,
      takerUserId: updatedTradeResult.takerUserId,
      createdAt: updatedTradeResult.createdAt,
      updatedAt: updatedTradeResult.updatedAt,
    };

    return this.mapTradeToResponse(updatedTrade);
  }

  private calculateUnrealizedPnl(
    side: string,
    amount: string,
    entryPrice: string,
    currentPrice: string,
  ): string {
    const amountNum = Number(amount);
    const entryPriceNum = Number(entryPrice);
    const currentPriceNum = Number(currentPrice);
    const direction = side === OrderSide.BUY ? 1 : -1;
    const pnl = (currentPriceNum - entryPriceNum) * amountNum * direction;
    return pnl.toString();
  }

  private async processTrades(trades: Trade[]) {
    for (const trade of trades) {
      await this.prisma.$transaction(async (prisma) => {
        const tradeData: TradeCreateData = {
          user: { connect: { id: trade.userId } },
          symbol: trade.symbol,
          side: trade.side,
          amount: trade.amount,
          price: trade.price,
          profitPercent: trade.profitPercent || 0,
          pnl: trade.pnl || '0',
          fee: trade.fee || '0',
          makerOrderId: trade.makerOrderId,
          takerOrderId: trade.takerOrderId,
          makerUserId: trade.makerUserId,
          takerUserId: trade.takerUserId,
        };

        const createdTradeResult = await prisma.trade.create({
          data: tradeData,
          include: {
            user: true,
          },
        });

        if (createdTradeResult.makerOrderId) {
          const makerOrder = await prisma.order.findUnique({
            where: { id: createdTradeResult.makerOrderId },
            include: {
              user: true,
              position: true,
            },
          });

          if (makerOrder) {
            const makerFilledQty = Number(makerOrder.filledQty);
            const tradeAmount = Number(createdTradeResult.amount);
            const newFilledQty = makerFilledQty + tradeAmount;
            
            const orderUpdateData: OrderUpdateData = {
              filledQty: { set: newFilledQty.toString() },
              status: { set: this.getUpdatedOrderStatus(newFilledQty) },
            };

            await prisma.order.update({
              where: { id: createdTradeResult.makerOrderId },
              data: orderUpdateData,
            });
          }
        }

        if (createdTradeResult.takerOrderId) {
          const takerOrder = await prisma.order.findUnique({
            where: { id: createdTradeResult.takerOrderId },
            include: {
              user: true,
              position: true,
            },
          });

          if (takerOrder) {
            const takerFilledQty = Number(takerOrder.filledQty);
            const tradeAmount = Number(createdTradeResult.amount);
            const newFilledQty = takerFilledQty + tradeAmount;
            
            const orderUpdateData: OrderUpdateData = {
              filledQty: { set: newFilledQty.toString() },
              status: { set: this.getUpdatedOrderStatus(newFilledQty) },
            };

            await prisma.order.update({
              where: { id: createdTradeResult.takerOrderId },
              data: orderUpdateData,
            });
          }
        }

        return createdTradeResult;
      });
    }
  }

  private calculateRequiredMargin(price: string, quantity: string, leverage: number): string {
    return (parseFloat(price) * parseFloat(quantity) / leverage).toString();
  }

  private calculateLiquidationPrice(params: {
    side: string;
    entryPrice: string;
    margin: number;
    leverage: number;
  }): string {
    const { side, entryPrice, margin, leverage } = params;
    const entryPriceNum = Number(entryPrice);
    const marginNum = margin;
    const leverageNum = leverage;

    let liquidationPrice: number;
    if (side === OrderSide.BUY) {
      liquidationPrice = entryPriceNum * (1 - marginNum / (entryPriceNum * leverageNum));
    } else {
      liquidationPrice = entryPriceNum * (1 + marginNum / (entryPriceNum * leverageNum));
    }

    return liquidationPrice.toString();
  }

  private calculateMinMargin(position: Position): string {
    return (parseFloat(position.quantity) * parseFloat(position.entryPrice) / position.leverage * 0.5).toString();
  }

  private getUpdatedOrderStatus(filledQty: number): string {
    if (filledQty === 0) {
      return OrderStatus.PENDING;
    } else if (filledQty > 0 && filledQty < 100) {
      return OrderStatus.PARTIALLY_FILLED;
    } else {
      return OrderStatus.FILLED;
    }
  }

  private getAssetPair(symbol: string): [string, string] {
    const [baseAsset, quoteAsset] = symbol.split('-');
    return [baseAsset, quoteAsset];
  }

  private mapOrderToResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      side: order.side as OrderSide,
      type: order.type as OrderType,
      price: order.price,
      quantity: order.quantity,
      leverage: order.leverage,
      margin: order.margin,
      timeInForce: order.timeInForce,
      status: order.status as OrderStatus,
      filledQty: order.filledQty,
      remainingQty: order.remainingQty,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private mapTradeToResponse(trade: Trade): TradeResponseDto {
    return {
      id: trade.id,
      userId: trade.userId,
      symbol: trade.symbol,
      side: trade.side as OrderSide,
      amount: trade.amount,
      price: trade.price,
      profitPercent: trade.profitPercent || 0,
      pnl: trade.pnl || '0',
      fee: trade.fee || '0',
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    };
  }

  private mapPositionToResponse(position: any): PositionResponseDto {
    return {
      id: position.id,
      userId: position.userId,
      symbol: position.symbol,
      side: position.side as OrderSide,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      leverage: position.leverage,
      liquidationPrice: position.liquidationPrice,
      margin: position.margin,
      unrealizedPnl: position.unrealizedPnl,
      realizedPnl: position.realizedPnl,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }
}
