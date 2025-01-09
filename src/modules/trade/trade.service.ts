import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import {
  Order,
  OrderStatus,
  OrderSide,
  Trade,
  Position,
} from './types/trade.types';
import { AssetService } from '../asset/asset.service';
import { OrderMatchingEngine } from './engines/order-matching.engine';
import { v4 as uuidv4 } from 'uuid';
import { RiskService } from '../risk/risk.service';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);
  private readonly matchingEngines = new Map<string, OrderMatchingEngine>();

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly assetService: AssetService,
    private readonly riskService: RiskService,
  ) {}

  async onModuleInit() {
    await this.initializeMatchingEngines();
  }

  private async initializeMatchingEngines() {
    try {
      const tradingPairs = await this.prisma.tradingPair.findMany({
        where: { isActive: true },
      });

      for (const pair of tradingPairs) {
        const engine = new OrderMatchingEngine(pair.symbol);
        await this.loadExistingOrders(engine, pair.symbol);
        this.matchingEngines.set(pair.symbol, engine);
      }

      this.logger.log(`Initialized matching engines for ${tradingPairs.length} trading pairs`);
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
        side: order.side,
        type: order.type,
        price: order.price,
        amount: order.amount - order.filled,
        timestamp: order.createdAt.getTime(),
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
      createOrderDto.amount,
      createOrderDto.leverage || 1,
      createOrderDto.price,
    );

    if (!isRiskValid) {
      throw new BadRequestException('Order exceeds risk limits');
    }

    // 计算所需保证金
    const margin = this.calculateRequiredMargin(
      createOrderDto.price,
      createOrderDto.amount,
      createOrderDto.leverage || 1,
    );

    // 检查用户余额
    const [baseAsset, quoteAsset] = this.getAssetPair(createOrderDto.symbol);
    
    if (createOrderDto.side === OrderSide.BUY) {
      const balance = await this.assetService.getUserBalance(userId, quoteAsset);
      if (balance.balance < margin) {
        throw new BadRequestException('Insufficient margin');
      }
    } else {
      const balance = await this.assetService.getUserBalance(userId, baseAsset);
      if (balance.balance < createOrderDto.amount) {
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
          amount: createOrderDto.amount,
          filled: 0,
          status: OrderStatus.PENDING,
          clientOrderId: createOrderDto.clientOrderId,
          leverage: createOrderDto.leverage,
          margin,
          stopLoss: createOrderDto.stopLoss,
          takeProfit: createOrderDto.takeProfit,
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
    const trades = await engine.processOrder({
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      price: order.price,
      amount: order.amount,
      timestamp: order.createdAt.getTime(),
    });

    // 处理交易
    if (trades.length > 0) {
      await this.processTrades(trades);
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
      const remainingMargin = order.margin * ((order.amount - order.filled) / order.amount);
      await this.assetService.unfreezeBalance(
        userId,
        order.side === OrderSide.BUY ? quoteAsset : baseAsset,
        remainingMargin,
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

    const snapshot = engine.getOrderBookSnapshot(limit);
    return {
      bids: snapshot.bids,
      asks: snapshot.asks,
    };
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

    const [trades, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      }),
      this.prisma.trade.count({ where }),
    ]);

    return {
      trades: trades.map(trade => this.mapTradeToResponse(trade)),
      total,
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

    const firstPrice = trades[trades.length - 1].price;
    const lastPrice = lastTrade.price;
    const volume = trades.reduce((sum, trade) => sum + trade.amount, 0);
    const high = Math.max(...trades.map(trade => trade.price));
    const low = Math.min(...trades.map(trade => trade.price));
    const change = lastPrice - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    const statistics = {
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
      throw new BadRequestException('Position not found');
    }

    // 更新止损止盈
    if (updateDto.stopLoss || updateDto.takeProfit) {
      const updatedPosition = await this.prisma.position.update({
        where: { id: positionId },
        data: {
          stopLoss: updateDto.stopLoss,
          takeProfit: updateDto.takeProfit,
        },
      });
      return this.mapPositionToResponse(updatedPosition);
    }

    // 增加或减少保证金
    if (updateDto.addMargin || updateDto.removeMargin) {
      return await this.prisma.$transaction(async (prisma) => {
        const [baseAsset, quoteAsset] = this.getAssetPair(position.symbol);
        const asset = position.side === OrderSide.BUY ? quoteAsset : baseAsset;

        if (updateDto.addMargin) {
          await this.assetService.freezeBalance(userId, asset, updateDto.addMargin);
          const updatedPosition = await prisma.position.update({
            where: { id: positionId },
            data: {
              margin: { increment: updateDto.addMargin },
              liquidationPrice: this.calculateLiquidationPrice({
                ...position,
                margin: position.margin + updateDto.addMargin,
              }),
            },
          });
          return this.mapPositionToResponse(updatedPosition);
        }

        if (updateDto.removeMargin) {
          const minMargin = this.calculateMinMargin(position);
          const maxRemovable = position.margin - minMargin;
          if (updateDto.removeMargin > maxRemovable) {
            throw new BadRequestException('Cannot remove this much margin');
          }

          await this.assetService.unfreezeBalance(userId, asset, updateDto.removeMargin);
          const updatedPosition = await prisma.position.update({
            where: { id: positionId },
            data: {
              margin: { decrement: updateDto.removeMargin },
              liquidationPrice: this.calculateLiquidationPrice({
                ...position,
                margin: position.margin - updateDto.removeMargin,
              }),
            },
          });
          return this.mapPositionToResponse(updatedPosition);
        }

        return this.mapPositionToResponse(position);
      });
    }

    return this.mapPositionToResponse(position);
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
    // 获取交易
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

    // 获取关联的订单
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: trade.makerOrderId },
          { id: trade.takerOrderId },
        ],
        userId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // 获取关联的仓位
    const position = await this.prisma.position.findFirst({
      where: {
        userId,
        symbol: trade.symbol,
        side: order.side,
      },
    });

    if (!position) {
      throw new NotFoundException('Position not found');
    }

    // 计算盈亏
    const pnl = this.calculateUnrealizedPnl(
      position.side,
      position.amount,
      position.entryPrice,
      trade.price,
    );

    // 更新仓位
    await this.prisma.$transaction(async (prisma) => {
      // 更新仓位状态
      await prisma.position.update({
        where: { id: position.id },
        data: {
          amount: 0,
          unrealizedPnl: 0,
          realizedPnl: position.realizedPnl + pnl,
        },
      });

      // 更新订单状态
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.FILLED,
          updatedAt: new Date(),
        },
      });

      // 更新交易状态
      const updatedTrade = await prisma.trade.update({
        where: { id: tradeId },
        data: {
          profit: pnl,
          profitPercent: (pnl / position.margin) * 100,
        },
      });

      // 解冻保证金
      const [baseAsset, quoteAsset] = this.getAssetPair(trade.symbol);
      await this.assetService.unfreezeBalance(
        userId,
        position.side === OrderSide.BUY ? quoteAsset : baseAsset,
        position.margin + pnl,
      );

      // 发送事件
      this.eventEmitter.emit('trade.closed', this.mapTradeToResponse(updatedTrade));

      return updatedTrade;
    });

    return this.mapTradeToResponse(trade);
  }

  private calculateUnrealizedPnl(
    side: string,
    amount: number,
    entryPrice: number,
    currentPrice: number,
  ): number {
    const direction = side === OrderSide.BUY ? 1 : -1;
    return (currentPrice - entryPrice) * amount * direction;
  }

  private async processTrades(trades: Trade[]) {
    for (const trade of trades) {
      await this.prisma.$transaction(async (prisma) => {
        // 创建交易记录
        const createdTrade = await prisma.trade.create({
          data: {
            id: uuidv4(),
            symbol: trade.symbol,
            makerOrderId: trade.makerOrderId,
            takerOrderId: trade.takerOrderId,
            makerUserId: trade.makerUserId,
            takerUserId: trade.takerUserId,
            price: trade.price,
            amount: trade.amount,
          },
        });

        // 更新maker订单
        const makerOrder = await prisma.order.update({
          where: { id: trade.makerOrderId },
          data: {
            filled: { increment: trade.amount },
            status: this.getUpdatedOrderStatus(trade.amount),
            updatedAt: new Date(),
          },
        });

        // 更新taker订单
        const takerOrder = await prisma.order.update({
          where: { id: trade.takerOrderId },
          data: {
            filled: { increment: trade.amount },
            status: this.getUpdatedOrderStatus(trade.amount),
            updatedAt: new Date(),
          },
        });

        // 更新或创建仓位
        await this.updatePositions(prisma, createdTrade, makerOrder, takerOrder);

        // 发送事件
        this.eventEmitter.emit('trade.created', this.mapTradeToResponse(createdTrade));
      });
    }
  }

  private async updatePositions(
    prisma: any,
    trade: Trade,
    makerOrder: Order,
    takerOrder: Order,
  ) {
    // 更新maker仓位
    await this.updateUserPosition(
      prisma,
      trade,
      makerOrder.userId,
      makerOrder.side,
      makerOrder.leverage,
      makerOrder.margin,
      true,
    );

    // 更新taker仓位
    await this.updateUserPosition(
      prisma,
      trade,
      takerOrder.userId,
      takerOrder.side,
      takerOrder.leverage,
      takerOrder.margin,
      false,
    );
  }

  private async updateUserPosition(
    prisma: any,
    trade: Trade,
    userId: string,
    side: OrderSide,
    leverage: number,
    margin: number,
    isMaker: boolean,
  ) {
    // 风险检查
    const isRiskValid = await this.riskService.checkPositionRisk(
      userId,
      trade.symbol,
      side,
      trade.amount,
      leverage,
      trade.price,
    );

    if (!isRiskValid) {
      throw new BadRequestException('Position exceeds risk limits');
    }

    const position = await prisma.position.findFirst({
      where: {
        userId,
        symbol: trade.symbol,
        side,
      },
    });

    if (!position) {
      // 创建新仓位
      const newPosition = await prisma.position.create({
        data: {
          id: uuidv4(),
          userId,
          symbol: trade.symbol,
          side,
          amount: trade.amount,
          entryPrice: trade.price,
          markPrice: trade.price,
          leverage,
          margin,
          liquidationPrice: this.calculateLiquidationPrice({
            side,
            entryPrice: trade.price,
            leverage,
            margin,
          }),
        },
      });

      // 检查清算风险
      await this.riskService.checkLiquidationRisk(newPosition.id);
    } else {
      // 更新现有仓位
      const newAmount = position.amount + trade.amount;
      const newEntryPrice = (position.entryPrice * position.amount + trade.price * trade.amount) / newAmount;
      
      const updatedPosition = await prisma.position.update({
        where: { id: position.id },
        data: {
          amount: newAmount,
          entryPrice: newEntryPrice,
          markPrice: trade.price,
          margin: position.margin + margin,
          liquidationPrice: this.calculateLiquidationPrice({
            side,
            entryPrice: newEntryPrice,
            leverage: position.leverage,
            margin: position.margin + margin,
          }),
        },
      });

      // 检查清算风险
      await this.riskService.checkLiquidationRisk(updatedPosition.id);
    }
  }

  private calculateRequiredMargin(price: number, amount: number, leverage: number): number {
    return (price * amount) / leverage;
  }

  private calculateLiquidationPrice(position: any): number {
    const maintenanceMargin = 0.005; // 0.5% 维持保证金率
    const direction = position.side === OrderSide.BUY ? 1 : -1;
    
    return position.entryPrice * (1 - direction * (1 - maintenanceMargin) / position.leverage);
  }

  private calculateMinMargin(position: Position): number {
    const maintenanceMargin = 0.005; // 0.5% 维持保证金率
    return position.entryPrice * position.amount * maintenanceMargin;
  }

  private getUpdatedOrderStatus(filled: number): OrderStatus {
    return filled === 0 ? OrderStatus.PENDING :
           filled < 1 ? OrderStatus.PARTIALLY_FILLED :
           OrderStatus.FILLED;
  }

  private getAssetPair(symbol: string): [string, string] {
    const [base, quote] = symbol.split('-');
    if (!base || !quote) {
      throw new BadRequestException('Invalid symbol format');
    }
    return [base, quote];
  }

  private mapOrderToResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      price: order.price,
      amount: order.amount,
      filled: order.filled,
      remaining: order.amount - order.filled,
      status: order.status,
      clientOrderId: order.clientOrderId,
      leverage: order.leverage,
      margin: order.margin,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private mapTradeToResponse(trade: any): TradeResponseDto {
    return {
      id: trade.id,
      symbol: trade.symbol,
      makerOrderId: trade.makerOrderId,
      takerOrderId: trade.takerOrderId,
      makerUserId: trade.makerUserId,
      takerUserId: trade.takerUserId,
      price: trade.price,
      amount: trade.amount,
      leverage: trade.leverage,
      profit: trade.profit,
      profitPercent: trade.profitPercent,
      margin: trade.margin,
      createdAt: trade.createdAt,
    };
  }

  private mapPositionToResponse(position: any): PositionResponseDto {
    return {
      id: position.id,
      userId: position.userId,
      symbol: position.symbol,
      side: position.side,
      amount: position.amount,
      entryPrice: position.entryPrice,
      markPrice: position.markPrice,
      leverage: position.leverage,
      margin: position.margin,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      liquidationPrice: position.liquidationPrice,
      unrealizedPnl: position.unrealizedPnl,
      realizedPnl: position.realizedPnl,
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }
}
