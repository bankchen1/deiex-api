import { Injectable } from '@nestjs/common';
import { RedisClientService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderBookDto, OrderBookEntryDto } from './dto/order-book.dto';
import { TradeHistoryDto, TradeDto } from './dto/trade-history.dto';
import { MarketDataDto } from './dto/market-data.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class MarketService {
  constructor(
    private readonly redis: RedisClientService,
    private readonly prisma: PrismaService,
  ) {}

  async getMarketData(symbol: string): Promise<MarketDataDto> {
    const marketData = await this.redis.hgetall(`market:${symbol}`);
    return {
      symbol,
      price: parseFloat(marketData.price || '0'),
      volume24h: parseFloat(marketData.volume24h || '0'),
      high24h: parseFloat(marketData.high24h || '0'),
      low24h: parseFloat(marketData.low24h || '0'),
      change24h: parseFloat(marketData.change24h || '0'),
    };
  }

  async getOrderBook(symbol: string): Promise<OrderBookDto> {
    const [bids, asks] = await Promise.all([
      this.redis.hgetall(`orderbook:${symbol}:bids`),
      this.redis.hgetall(`orderbook:${symbol}:asks`),
    ]);

    return {
      symbol,
      bids: Object.entries(bids).map(([price, quantity]): OrderBookEntryDto => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      asks: Object.entries(asks).map(([price, quantity]): OrderBookEntryDto => ({
        price: parseFloat(price),
        quantity: parseFloat(quantity),
      })),
      timestamp: Date.now(),
    };
  }

  async getTradeHistory(symbol: string): Promise<TradeHistoryDto> {
    const trades = await this.prisma.trade.findMany({
      where: { symbol },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      symbol,
      trades: trades.map((trade): TradeDto => ({
        id: trade.id,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.amount),
        side: trade.side.toLowerCase() as 'buy' | 'sell',
        createdAt: trade.createdAt,
      })),
    };
  }

  async updateMarketData(symbol: string, data: Partial<MarketDataDto>): Promise<void> {
    const updates = Object.entries(data)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [key, value.toString()]);

    if (updates.length > 0) {
      for (const [key, value] of updates) {
        await this.redis.hset(`market:${symbol}`, key, value);
      }
    }
  }

  async updateOrderBook(symbol: string, side: string, price: number, quantity: number): Promise<void> {
    const key = `orderbook:${symbol}:${side.toLowerCase()}s`;
    if (quantity > 0) {
      await this.redis.hset(key, price.toString(), quantity.toString());
    } else {
      await this.redis.hdel(key, price.toString());
    }
  }
}
