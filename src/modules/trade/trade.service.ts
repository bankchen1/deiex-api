import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { BigNumber } from 'bignumber.js';
import { Prisma } from '@prisma/client';
import {
  OrderSide,
  OrderType,
  OrderStatus,
  Trade,
  Order,
  Position,
  MatchResult,
} from './types/trade.types';
import {
  PrismaTrade,
  PrismaOrder,
  PrismaPosition,
  TradeCreateInput,
  OrderCreateInput,
  PositionCreateInput,
  TradeWhereInput,
} from './types/trade.prisma';
import {
  CreateOrderDto,
  OrderResponseDto,
  TradeResponseDto,
  PositionResponseDto,
} from './dto/trade.dto';
import { AssetService } from '../asset/asset.service';
import { RiskService } from '../risk/risk.service';
import { OrderMatchingEngine } from './engines/order-matching.engine';

@Injectable()
export class TradeService {
  private readonly matchingEngines = new Map<string, OrderMatchingEngine>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly assetService: AssetService,
    private readonly riskService: RiskService,
  ) {}

  async processTrades(trades: Trade[]): Promise<void> {
    for (const trade of trades) {
      await this.prisma.$transaction(async (prisma) => {
        // 创建交易记录
        const tradeData: TradeCreateInput = {
          symbol: trade.symbol,
          side: trade.side,
          amount: trade.amount,
          price: trade.price,
          profitPercent: trade.profitPercent || null,
          pnl: trade.pnl || null,
          fee: trade.fee || null,
          makerOrderId: trade.makerOrderId || null,
          takerOrderId: trade.takerOrderId || null,
          makerUserId: trade.makerUserId || null,
          takerUserId: trade.takerUserId || null,
          orderId: trade.orderId || null,
          user: { connect: { id: trade.userId } },
        };

        await prisma.trade.create({
          data: tradeData,
          include: {
            user: true,
          },
        });

        // 更新订单状态
        if (trade.makerOrderId) {
          const makerOrder = await prisma.order.findUnique({
            where: { id: trade.makerOrderId },
            include: {
              user: true,
              position: true,
            },
          });

          if (makerOrder) {
            const filledQty = new BigNumber(makerOrder.filledQty)
              .plus(trade.amount)
              .toString();
            const remainingQty = new BigNumber(makerOrder.quantity)
              .minus(filledQty)
              .toString();

            await prisma.order.update({
              where: { id: trade.makerOrderId },
              data: {
                filledQty,
                remainingQty,
                status:
                  remainingQty === '0'
                    ? OrderStatus.FILLED
                    : OrderStatus.PARTIALLY_FILLED,
              },
            });
          }
        }

        if (trade.takerOrderId) {
          const takerOrder = await prisma.order.findUnique({
            where: { id: trade.takerOrderId },
            include: {
              user: true,
              position: true,
            },
          });

          if (takerOrder) {
            const filledQty = new BigNumber(takerOrder.filledQty)
              .plus(trade.amount)
              .toString();
            const remainingQty = new BigNumber(takerOrder.quantity)
              .minus(filledQty)
              .toString();

            await prisma.order.update({
              where: { id: trade.takerOrderId },
              data: {
                filledQty,
                remainingQty,
                status:
                  remainingQty === '0'
                    ? OrderStatus.FILLED
                    : OrderStatus.PARTIALLY_FILLED,
              },
            });
          }
        }
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
    const orderData: OrderCreateInput = {
      symbol: createOrderDto.symbol,
      side: createOrderDto.side,
      type: createOrderDto.type,
      price: createOrderDto.price,
      quantity: createOrderDto.quantity,
      filledQty: '0',
      status: OrderStatus.PENDING,
      leverage: createOrderDto.leverage || 1,
      margin,
      timeInForce: createOrderDto.timeInForce,
      user: { connect: { id: userId } },
    };

    const order = await this.prisma.$transaction(async (prisma) => {
      // 创建订单记录
      const createdOrder = await prisma.order.create({
        data: orderData,
        include: {
          user: true,
          position: true,
        },
      });

      // 冻结保证金
      await this.assetService.freezeBalance(
        userId,
        createOrderDto.side === OrderSide.BUY ? quoteAsset : baseAsset,
        margin,
      );

      return createdOrder;
    });

    // 处理订单匹配
    const matchResult = await engine.processOrder({
      ...order,
      remainingQty: order.quantity,
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

  private calculateRequiredMargin(price: string, quantity: string, leverage: number): string {
    return (parseFloat(price) * parseFloat(quantity) / leverage).toString();
  }

  private getAssetPair(symbol: string): [string, string] {
    const [baseAsset, quoteAsset] = symbol.split('-');
    return [baseAsset, quoteAsset];
  }

  private mapOrderToResponse(order: PrismaOrder): OrderResponseDto {
    const response = new OrderResponseDto();
    response.id = order.id;
    response.userId = order.userId;
    response.symbol = order.symbol;
    response.side = order.side as OrderSide;
    response.type = order.type as OrderType;
    response.price = order.price;
    response.quantity = order.quantity;
    response.leverage = order.leverage;
    response.margin = order.margin;
    response.timeInForce = order.timeInForce;
    response.status = order.status as OrderStatus;
    response.filledQty = order.filledQty;
    response.remainingQty = order.remainingQty || undefined;
    response.createdAt = order.createdAt;
    response.updatedAt = order.updatedAt;
    return response;
  }

  private mapTradeToResponse(trade: PrismaTrade): TradeResponseDto {
    const response = new TradeResponseDto();
    response.id = trade.id;
    response.userId = trade.userId;
    response.symbol = trade.symbol;
    response.side = trade.side as OrderSide;
    response.amount = trade.amount;
    response.price = trade.price;
    response.profitPercent = trade.profitPercent || 0;
    response.pnl = trade.pnl || '0';
    response.fee = trade.fee || '0';
    response.makerOrderId = trade.makerOrderId || undefined;
    response.takerOrderId = trade.takerOrderId || undefined;
    response.makerUserId = trade.makerUserId || undefined;
    response.takerUserId = trade.takerUserId || undefined;
    response.createdAt = trade.createdAt;
    response.updatedAt = trade.updatedAt;
    return response;
  }

  private mapPositionToResponse(position: PrismaPosition): PositionResponseDto {
    const response = new PositionResponseDto();
    response.id = position.id;
    response.userId = position.userId;
    response.symbol = position.symbol;
    response.side = position.side as OrderSide;
    response.quantity = position.quantity;
    response.entryPrice = position.entryPrice;
    response.leverage = position.leverage;
    response.liquidationPrice = position.liquidationPrice;
    response.margin = position.margin;
    response.unrealizedPnl = position.unrealizedPnl;
    response.realizedPnl = position.realizedPnl;
    response.createdAt = position.createdAt;
    response.updatedAt = position.updatedAt;
    return response;
  }

  async getUserTrades(userId: string, symbol?: string): Promise<TradeResponseDto[]> {
    const where: TradeWhereInput = {
      OR: [
        { userId },
        { makerUserId: userId },
        { takerUserId: userId },
      ],
    };

    if (symbol) {
      where.symbol = symbol;
    }

    const trades = await this.prisma.trade.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });

    return trades.map(trade => this.mapTradeToResponse(trade));
  }

  // ... rest of the file remains unchanged ...
}
