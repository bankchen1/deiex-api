import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import { OrderBook } from './order-book';
import { PerpetualOrder, OrderStatus } from '../types/perpetual.types';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../../shared/services/prometheus.service';

@Injectable()
export class MatchingEngineService implements OnModuleInit {
  private readonly logger = new Logger(MatchingEngineService.name);
  private readonly orderBooks = new Map<string, OrderBook>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {}

  async onModuleInit() {
    try {
      // 初始化所有交易对的订单簿
      const symbols = this.configService.get<string[]>('perpetual.symbols');
      if (!symbols) {
        throw new Error('No symbols configured for perpetual trading');
      }

      for (const symbol of symbols) {
        this.orderBooks.set(
          symbol,
          new OrderBook(symbol, this.eventEmitter, this.redisService),
        );
      }

      // 订阅订单事件
      this.subscribeToEvents();

      this.logger.log('Matching engine initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize matching engine: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async placeOrder(order: PerpetualOrder): Promise<void> {
    try {
      const orderBook = this.getOrderBook(order.symbol);
      const startTime = Date.now();

      await orderBook.addOrder(order);

      // 记录订单处理延迟
      this.prometheusService.observeOrderProcessingTime(
        Date.now() - startTime,
      );

      // 更新订单计数
      this.prometheusService.incrementOrderCount(order.type);
    } catch (error) {
      this.logger.error(
        `Failed to place order ${order.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      const orderBook = this.getOrderBook(symbol);
      await orderBook.cancelOrder(orderId);

      // 更新取消订单计数
      this.prometheusService.incrementCancelledOrderCount();
    } catch (error) {
      this.logger.error(
        `Failed to cancel order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getOrder(orderId: string, symbol: string): PerpetualOrder | undefined {
    try {
      const orderBook = this.getOrderBook(symbol);
      return orderBook.getOrder(orderId);
    } catch (error) {
      this.logger.error(
        `Failed to get order ${orderId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getOrderBookDepth(symbol: string, levels: number = 20): {
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
  } {
    try {
      const orderBook = this.getOrderBook(symbol);
      const depth = orderBook.getDepth(levels);

      return {
        bids: depth.bids.map(({ price, size }) => ({ price, size })),
        asks: depth.asks.map(({ price, size }) => ({ price, size })),
      };
    } catch (error) {
      this.logger.error(
        `Failed to get order book depth for ${symbol}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getBestPrices(symbol: string): {
    bestBid?: number;
    bestAsk?: number;
  } {
    try {
      const orderBook = this.getOrderBook(symbol);
      const bestBid = orderBook.getBestBid();
      const bestAsk = orderBook.getBestAsk();

      return {
        bestBid: bestBid?.price,
        bestAsk: bestAsk?.price,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get best prices for ${symbol}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getOrderBook(symbol: string): OrderBook {
    const orderBook = this.orderBooks.get(symbol);
    if (!orderBook) {
      throw new Error(`Order book not found for symbol: ${symbol}`);
    }
    return orderBook;
  }

  private subscribeToEvents(): void {
    // 监听订单更新事件
    this.eventEmitter.on('order.updated', (order: PerpetualOrder) => {
      try {
        // 发送订单状态更新到客户端
        this.eventEmitter.emit(`order:${order.userId}`, {
          type: 'ORDER_UPDATE',
          data: order,
        });

        // 更新指标
        if (order.status === OrderStatus.FILLED) {
          this.prometheusService.incrementFilledOrderCount();
        }
      } catch (error) {
        this.logger.error(
          `Failed to handle order update event: ${error.message}`,
          error.stack,
        );
      }
    });

    // 监听成交事件
    this.eventEmitter.on(
      'trade.executed',
      async (trade: {
        symbol: string;
        buyOrderId: string;
        sellOrderId: string;
        amount: number;
        price: number;
        timestamp: Date;
      }) => {
        try {
          // 更新最新成交价格缓存
          await this.redisService.set(
            `lastPrice:${trade.symbol}`,
            trade.price.toString(),
            60 * 60, // 1 hour cache
          );

          // 发送成交信息到客户端
          this.eventEmitter.emit(`trades:${trade.symbol}`, {
            type: 'TRADE',
            data: trade,
          });

          // 更新成交量指标
          this.prometheusService.incrementTradeVolume(
            trade.symbol,
            trade.amount * trade.price,
          );
        } catch (error) {
          this.logger.error(
            `Failed to handle trade executed event: ${error.message}`,
            error.stack,
          );
        }
      },
    );
  }
}
