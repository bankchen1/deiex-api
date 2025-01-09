import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../modules/prisma/prisma.service';
import { RedisService } from '../../../modules/redis/redis.service';
import { OrderBookLevel } from '../../trade/types/order-book.types';

@Injectable()
export class DepthService {
  private readonly logger = new Logger(DepthService.name);
  private readonly DEPTH_UPDATE_INTERVAL: number = 100; // ms
  private readonly depthLevels: number;
  private readonly depthUpdateThreshold: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.depthLevels = this.configService.get('DEPTH_LEVELS', 100);
    this.depthUpdateThreshold = this.configService.get('DEPTH_UPDATE_THRESHOLD', 0.1);
  }

  async updateDepth(symbol: string, side: 'BUY' | 'SELL', price: number, amount: number) {
    const key = `depth:${symbol}:${side.toLowerCase()}`;
    const redis = this.redisService.getClient();
    
    try {
      await redis.watch(key);
      
      // 获取当前价格层级的数量
      const currentAmount = parseFloat(await redis.hget(key, price.toString()) || '0');
      const newAmount = Math.max(0, currentAmount + amount);

      if (newAmount === 0) {
        // 如果数量为0，删除该价格层级
        await redis.hdel(key, price.toString());
      } else {
        // 更新价格层级的数量
        await redis.hset(key, price.toString(), newAmount.toString());
      }

      // 获取更新后的深度数据
      const depth = await this.getDepth(symbol);
      
      // 发送深度更新事件
      this.eventEmitter.emit('depth.updated', {
        symbol,
        side,
        price,
        amount: newAmount,
        depth,
      });

    } catch (error) {
      this.logger.error(`Failed to update depth: ${error.message}`);
      throw error;
    } finally {
      await redis.unwatch();
    }
  }

  async getDepth(symbol: string): Promise<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }> {
    const redis = this.redisService.getClient();
    const buyKey = `depth:${symbol}:buy`;
    const sellKey = `depth:${symbol}:sell`;

    try {
      const [buyOrders, sellOrders] = await Promise.all([
        redis.hgetall(buyKey),
        redis.hgetall(sellKey),
      ]);

      const bids = Object.entries(buyOrders)
        .map(([price, amount]) => ({
          price: parseFloat(price),
          amount: parseFloat(amount),
          orders: 0,
          total: 0, // Will be calculated below
        }))
        .sort((a, b) => b.price - a.price)
        .slice(0, this.depthLevels);

      const asks = Object.entries(sellOrders)
        .map(([price, amount]) => ({
          price: parseFloat(price),
          amount: parseFloat(amount),
          orders: 0,
          total: 0, // Will be calculated below
        }))
        .sort((a, b) => a.price - b.price)
        .slice(0, this.depthLevels);

      // Calculate running totals
      let bidTotal = 0;
      bids.forEach(bid => {
        bidTotal += bid.amount;
        bid.total = bidTotal;
      });

      let askTotal = 0;
      asks.forEach(ask => {
        askTotal += ask.amount;
        ask.total = askTotal;
      });

      // 获取每个价格层级的订单数量
      const orderCountMap = new Map<number, number>();
      const orders = await this.prisma.order.groupBy({
        by: ['price'],
        _count: {
          id: true,
        },
        where: {
          symbol,
          status: 'OPEN',
        },
      });

      orders.forEach((order) => {
        orderCountMap.set(order.price, order._count.id);
      });

      // 更新订单数量
      [...bids, ...asks].forEach((level) => {
        level.orders = orderCountMap.get(level.price) ?? 0;
      });

      return { bids, asks };
    } catch (error) {
      this.logger.error(`Failed to get depth: ${error.message}`);
      throw error;
    }
  }

  @OnEvent('trade.executed')
  async handleTradeExecuted(event: any) {
    const { symbol, side, price, amount } = event;
    await this.updateDepth(symbol, side, price, -amount); // 减少深度
  }

  @OnEvent('order.canceled')
  async handleOrderCanceled(event: any) {
    const { symbol, side, price, amount } = event;
    await this.updateDepth(symbol, side, price, -amount); // 减少深度
  }

  @OnEvent('order.created')
  async handleOrderCreated(event: any) {
    const { symbol, side, price, amount } = event;
    await this.updateDepth(symbol, side, price, amount); // 增加深度
  }
}
