import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../modules/prisma/prisma.service';
import { Order, OrderSide, OrderStatus, Trade } from '../types/trade.types';
import { OrderBook, OrderBookLevel, MatchResult } from '../types/order-book.types';
import { AssetService } from '../../asset/asset.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrderMatchingEngine {
  private readonly logger = new Logger(OrderMatchingEngine.name);
  private orderBooks: Map<string, OrderBook> = new Map();
  private readonly depthLevels: number;

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly assetService: AssetService,
    private readonly configService: ConfigService,
  ) {
    this.depthLevels = this.configService.get('DEPTH_LEVELS', 100);
  }

  async processOrder(order: Order): Promise<MatchResult> {
    const symbol = order.symbol;
    const orderBook = await this.getOrderBook(symbol);
    const matchedOrders: MatchResult['matchedOrders'] = [];
    let remainingAmount = order.amount;

    try {
      await this.redis.watch(`orderbook:${symbol}`);

      const oppositeOrders = order.side === OrderSide.BUY 
        ? orderBook.asks.levels
        : orderBook.bids.levels;

      for (const level of oppositeOrders) {
        if (remainingAmount <= 0) break;
        
        if (order.side === OrderSide.BUY && level.price > order.price) break;
        if (order.side === OrderSide.SELL && level.price < order.price) break;

        const matchAmount = Math.min(remainingAmount, level.amount);
        if (matchAmount <= 0) continue;

        const trade = await this.executeTrade({
          takerOrder: order,
          makerPrice: level.price,
          amount: matchAmount,
        });

        if (trade) {
          matchedOrders.push({
            orderId: trade.makerOrderId,
            price: trade.price,
            amount: trade.amount,
            timestamp: trade.timestamp,
          });
          remainingAmount -= matchAmount;
          
          // 更新订单簿
          await this.updateOrderBook(symbol, order.side, level.price, -matchAmount);
        }
      }

      // 如果是限价单且还有剩余数量，添加到订单簿
      if (remainingAmount > 0 && order.type === 'LIMIT') {
        await this.addToOrderBook(symbol, order, remainingAmount);
      }

      await this.redis.exec();

      return {
        orderId: order.id,
        matchedOrders,
        remainingAmount,
        status: this.getOrderStatus(order.amount, remainingAmount),
      };

    } catch (error) {
      this.logger.error(`Error processing order: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.redis.unwatch();
    }
  }

  private async executeTrade(params: {
    takerOrder: Order;
    makerPrice: number;
    amount: number;
  }): Promise<Trade> {
    const { takerOrder, makerPrice, amount } = params;

    return await this.prisma.$transaction(async (prisma) => {
      // 1. 创建交易记录
      const trade = await prisma.trade.create({
        data: {
          symbol: takerOrder.symbol,
          price: makerPrice,
          amount: amount,
          takerId: takerOrder.userId,
          takerSide: takerOrder.side,
          takerOrderId: takerOrder.id,
        },
      });

      // 2. 更新订单状态
      await prisma.order.update({
        where: { id: takerOrder.id },
        data: {
          filled: { increment: amount },
          status: this.getOrderStatus(takerOrder.amount, takerOrder.filled + amount),
        },
      });

      // 3. 发送交易事件
      this.eventEmitter.emit('trade.executed', trade);

      return trade;
    });
  }

  private async getOrderBook(symbol: string): Promise<OrderBook> {
    const cachedOrderBook = await this.redis.get(`orderbook:${symbol}`);
    if (cachedOrderBook) {
      return JSON.parse(cachedOrderBook);
    }

    const orderBook = await this.buildOrderBook(symbol);
    await this.redis.set(
      `orderbook:${symbol}`,
      JSON.stringify(orderBook),
      'EX',
      60
    );

    return orderBook;
  }

  private async buildOrderBook(symbol: string): Promise<OrderBook> {
    const [bids, asks] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['price'],
        where: {
          symbol,
          side: OrderSide.BUY,
          status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        },
        _sum: { remainingAmount: true },
        _count: { id: true },
        orderBy: { price: 'desc' },
        take: this.depthLevels,
      }),
      this.prisma.order.groupBy({
        by: ['price'],
        where: {
          symbol,
          side: OrderSide.SELL,
          status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        },
        _sum: { remainingAmount: true },
        _count: { id: true },
        orderBy: { price: 'asc' },
        take: this.depthLevels,
      }),
    ]);

    return {
      symbol,
      bids: this.buildOrderBookSide(bids),
      asks: this.buildOrderBookSide(asks),
      timestamp: Date.now(),
      lastUpdateId: await this.getLastUpdateId(symbol),
    };
  }

  private getOrderStatus(total: number, filled: number): OrderStatus {
    if (filled >= total) return OrderStatus.FILLED;
    if (filled > 0) return OrderStatus.PARTIALLY_FILLED;
    return OrderStatus.OPEN;
  }

  @OnEvent('order.canceled')
  async handleOrderCanceled(order: Order) {
    await this.updateOrderBook(
      order.symbol,
      order.side,
      order.price,
      -order.remainingAmount
    );
  }
}
