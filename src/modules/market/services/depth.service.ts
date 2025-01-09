import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../modules/prisma/prisma.service';
import { OrderBookLevel } from '../../trade/types/order-book.types';

@Injectable()
export class DepthService {
  private readonly logger = new Logger(DepthService.name);
  private readonly depthLevels: number;
  private readonly depthUpdateThreshold: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.depthLevels = this.configService.get('DEPTH_LEVELS', 100);
    this.depthUpdateThreshold = this.configService.get('DEPTH_UPDATE_THRESHOLD', 0.1);
  }

  async updateDepth(symbol: string, side: 'BUY' | 'SELL', price: number, amount: number) {
    const key = `depth:${symbol}:${side.toLowerCase()}`;
    
    try {
      await this.redis.watch(key);
      
      // 获取当前价格层级的数量
      const currentAmount = parseFloat(await this.redis.hget(key, price.toString()) || '0');
      const newAmount = Math.max(0, currentAmount + amount);

      if (newAmount === 0) {
        // 如果数量为0，删除该价格层级
        await this.redis.hdel(key, price.toString());
      } else {
        // 更新价格层级的数量
        await this.redis.hset(key, price.toString(), newAmount.toString());
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
        timestamp: Date.now(),
      });

      await this.redis.exec();
    } catch (error) {
      this.logger.error(`Error updating depth for ${symbol}: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.redis.unwatch();
    }
  }

  async getDepth(symbol: string): Promise<{
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
  }> {
    const [bids, asks] = await Promise.all([
      this.getDepthSide(symbol, 'BUY'),
      this.getDepthSide(symbol, 'SELL'),
    ]);

    return { bids, asks };
  }

  private async getDepthSide(symbol: string, side: 'BUY' | 'SELL'): Promise<OrderBookLevel[]> {
    const key = `depth:${symbol}:${side.toLowerCase()}`;
    const depthData = await this.redis.hgetall(key);
    
    const levels = Object.entries(depthData)
      .map(([price, amount]) => ({
        price: parseFloat(price),
        amount: parseFloat(amount),
        total: 0, // Will be calculated below
        orders: 0, // Will be updated from database
      }))
      .sort((a, b) => side === 'BUY' ? b.price - a.price : a.price - b.price)
      .slice(0, this.depthLevels);

    // Calculate running total
    let runningTotal = 0;
    levels.forEach(level => {
      runningTotal += level.amount;
      level.total = runningTotal;
    });

    // Get order counts from database
    const orderCounts = await this.prisma.order.groupBy({
      by: ['price'],
      where: {
        symbol,
        side,
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        price: { in: levels.map(l => l.price) },
      },
      _count: { id: true },
    });

    // Update order counts
    const orderCountMap = new Map(
      orderCounts.map(count => [count.price, count._count.id])
    );
    
    levels.forEach(level => {
      level.orders = orderCountMap.get(level.price) || 0;
    });

    return levels;
  }

  @OnEvent('trade.executed')
  async handleTradeExecuted(trade: any) {
    // 更新买卖双方的深度数据
    await Promise.all([
      this.updateDepth(
        trade.symbol,
        trade.takerSide,
        trade.price,
        -trade.amount
      ),
      this.updateDepth(
        trade.symbol,
        trade.takerSide === 'BUY' ? 'SELL' : 'BUY',
        trade.price,
        -trade.amount
      ),
    ]);
  }

  @OnEvent('order.canceled')
  async handleOrderCanceled(order: any) {
    await this.updateDepth(
      order.symbol,
      order.side,
      order.price,
      -order.remainingAmount
    );
  }

  @OnEvent('order.created')
  async handleOrderCreated(order: any) {
    if (order.type === 'LIMIT') {
      await this.updateDepth(
        order.symbol,
        order.side,
        order.price,
        order.amount
      );
    }
  }
}
