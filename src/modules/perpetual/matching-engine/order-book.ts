import { Injectable, Logger } from '@nestjs/common';
import { PriorityQueue } from './priority-queue';
import { OrderStatus, PerpetualOrder, PositionSide } from '../types/perpetual.types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';

interface OrderBookLevel {
  price: number;
  size: number;
  orders: PerpetualOrder[];
}

@Injectable()
export class OrderBook {
  private readonly logger = new Logger(OrderBook.name);
  private readonly bids: PriorityQueue<OrderBookLevel>;
  private readonly asks: PriorityQueue<OrderBookLevel>;
  private readonly orders: Map<string, PerpetualOrder>;

  constructor(
    private readonly symbol: string,
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
  ) {
    // 买单按价格降序排列
    this.bids = new PriorityQueue<OrderBookLevel>((a, b) => b.price - a.price);
    // 卖单按价格升序排列
    this.asks = new PriorityQueue<OrderBookLevel>((a, b) => a.price - b.price);
    this.orders = new Map<string, PerpetualOrder>();
  }

  async addOrder(order: PerpetualOrder): Promise<void> {
    try {
      // 保存订单
      this.orders.set(order.id, order);

      // 根据订单类型和方向添加到相应的队列
      if (order.side === PositionSide.LONG) {
        await this.matchBuyOrder(order);
      } else {
        await this.matchSellOrder(order);
      }

      // 发送订单更新事件
      this.eventEmitter.emit('order.updated', order);

      // 更新 Redis 缓存
      await this.updateRedisCache();
    } catch (error) {
      this.logger.error(
        `Failed to add order ${order.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      const order = this.orders.get(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      // 从订单簿中移除订单
      if (order.side === PositionSide.LONG) {
        this.removeFromBids(order);
      } else {
        this.removeFromAsks(order);
      }

      // 更新订单状态
      order.status = OrderStatus.CANCELED;
      this.orders.delete(orderId);

      // 发送订单更新事件
      this.eventEmitter.emit('order.canceled', order);

      // 更新 Redis 缓存
      await this.updateRedisCache();
    } catch (error) {
      this.logger.error(
        `Failed to cancel order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getOrder(orderId: string): PerpetualOrder | undefined {
    return this.orders.get(orderId);
  }

  getBestBid(): OrderBookLevel | undefined {
    return this.bids.peek();
  }

  getBestAsk(): OrderBookLevel | undefined {
    return this.asks.peek();
  }

  getDepth(levels: number): { bids: OrderBookLevel[]; asks: OrderBookLevel[] } {
    return {
      bids: this.bids.toArray().slice(0, levels),
      asks: this.asks.toArray().slice(0, levels),
    };
  }

  private async matchBuyOrder(order: PerpetualOrder): Promise<void> {
    let remainingAmount = order.amount;

    // 尝试与卖单匹配
    while (remainingAmount > 0) {
      const bestAsk = this.asks.peek();
      if (!bestAsk || bestAsk.price > order.price) {
        break;
      }

      const matchAmount = Math.min(remainingAmount, bestAsk.size);
      const matchPrice = bestAsk.price;

      // 执行撮合
      await this.executeTrade({
        buyOrder: order,
        sellOrder: bestAsk.orders[0],
        amount: matchAmount,
        price: matchPrice,
      });

      remainingAmount -= matchAmount;
      bestAsk.size -= matchAmount;

      // 移除完全成交的订单
      if (bestAsk.size === 0) {
        this.asks.pop();
      }
    }

    // 如果还有剩余数量，添加到买单队列
    if (remainingAmount > 0) {
      this.addToBids({
        price: order.price,
        size: remainingAmount,
        orders: [order],
      });
    }
  }

  private async matchSellOrder(order: PerpetualOrder): Promise<void> {
    let remainingAmount = order.amount;

    // 尝试与买单匹配
    while (remainingAmount > 0) {
      const bestBid = this.bids.peek();
      if (!bestBid || bestBid.price < order.price) {
        break;
      }

      const matchAmount = Math.min(remainingAmount, bestBid.size);
      const matchPrice = bestBid.price;

      // 执行撮合
      await this.executeTrade({
        buyOrder: bestBid.orders[0],
        sellOrder: order,
        amount: matchAmount,
        price: matchPrice,
      });

      remainingAmount -= matchAmount;
      bestBid.size -= matchAmount;

      // 移除完全成交的订单
      if (bestBid.size === 0) {
        this.bids.pop();
      }
    }

    // 如果还有剩余数量，添加到卖单队列
    if (remainingAmount > 0) {
      this.addToAsks({
        price: order.price,
        size: remainingAmount,
        orders: [order],
      });
    }
  }

  private async executeTrade(trade: {
    buyOrder: PerpetualOrder;
    sellOrder: PerpetualOrder;
    amount: number;
    price: number;
  }): Promise<void> {
    try {
      const { buyOrder, sellOrder, amount, price } = trade;

      // 更新订单状态
      this.updateOrderStatus(buyOrder, amount, price);
      this.updateOrderStatus(sellOrder, amount, price);

      // 发送成交事件
      this.eventEmitter.emit('trade.executed', {
        symbol: this.symbol,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        amount,
        price,
        timestamp: new Date(),
      });

      // 更新 Redis 缓存
      await this.updateRedisCache();
    } catch (error) {
      this.logger.error(
        `Failed to execute trade: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private updateOrderStatus(
    order: PerpetualOrder,
    amount: number,
    price: number,
  ): void {
    order.filled += amount;
    order.avgPrice = (order.avgPrice * (order.filled - amount) + price * amount) / order.filled;

    if (order.filled >= order.amount) {
      order.status = OrderStatus.FILLED;
      this.orders.delete(order.id);
    } else {
      order.status = OrderStatus.PARTIALLY_FILLED;
    }
  }

  private addToBids(level: OrderBookLevel): void {
    const existingLevel = this.bids
      .toArray()
      .find((l) => l.price === level.price);

    if (existingLevel) {
      existingLevel.size += level.size;
      existingLevel.orders.push(...level.orders);
    } else {
      this.bids.push(level);
    }
  }

  private addToAsks(level: OrderBookLevel): void {
    const existingLevel = this.asks
      .toArray()
      .find((l) => l.price === level.price);

    if (existingLevel) {
      existingLevel.size += level.size;
      existingLevel.orders.push(...level.orders);
    } else {
      this.asks.push(level);
    }
  }

  private removeFromBids(order: PerpetualOrder): void {
    const level = this.bids
      .toArray()
      .find((l) => l.orders.some((o) => o.id === order.id));

    if (level) {
      level.size -= order.amount - order.filled;
      level.orders = level.orders.filter((o) => o.id !== order.id);

      if (level.orders.length === 0) {
        this.bids.remove((l) => l === level);
      }
    }
  }

  private removeFromAsks(order: PerpetualOrder): void {
    const level = this.asks
      .toArray()
      .find((l) => l.orders.some((o) => o.id === order.id));

    if (level) {
      level.size -= order.amount - order.filled;
      level.orders = level.orders.filter((o) => o.id !== order.id);

      if (level.orders.length === 0) {
        this.asks.remove((l) => l === level);
      }
    }
  }

  private async updateRedisCache(): Promise<void> {
    try {
      const orderBookData = {
        symbol: this.symbol,
        bids: this.bids.toArray(),
        asks: this.asks.toArray(),
        timestamp: Date.now(),
      };

      await this.redisService.set(
        `orderbook:${this.symbol}`,
        JSON.stringify(orderBookData),
        60 * 60, // 1 hour cache
      );
    } catch (error) {
      this.logger.error(
        `Failed to update Redis cache: ${error.message}`,
        error.stack,
      );
    }
  }
}
