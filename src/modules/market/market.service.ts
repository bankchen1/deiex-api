import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {
  MarketOverviewDto,
  TickerDto,
  OrderBookDto,
  KlineDto,
  KlineInterval,
  RecentTradeDto,
} from './dto/market.dto';

@Injectable()
export class MarketService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getOverview(): Promise<MarketOverviewDto> {
    const btcTicker = await this.getTicker('BTCUSDT');
    return {
      btc: {
        price: btcTicker.price,
        priceChangePercent: btcTicker.priceChangePercent,
      },
    };
  }

  async getTickers(): Promise<TickerDto[]> {
    const tickers = await this.redis.hgetall('tickers');
    return Object.entries(tickers).map(([symbol, data]) => {
      const ticker = JSON.parse(data);
      return {
        symbol,
        price: ticker.price,
        priceChangePercent: ticker.priceChangePercent,
        volume: ticker.volume,
        count: ticker.count,
      };
    });
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const data = await this.redis.hget('tickers', symbol);
    if (!data) {
      throw new Error(`Ticker not found for symbol: ${symbol}`);
    }
    const ticker = JSON.parse(data);
    return {
      symbol,
      price: ticker.price,
      priceChangePercent: ticker.priceChangePercent,
      volume: ticker.volume,
      count: ticker.count,
    };
  }

  async getOrderBook(symbol: string, limit?: number): Promise<OrderBookDto> {
    const data = await this.redis.hget('orderbooks', symbol);
    if (!data) {
      throw new Error(`Order book not found for symbol: ${symbol}`);
    }
    const orderBook = JSON.parse(data);
    const maxDepth = limit || 100;
    return {
      lastUpdateId: orderBook.lastUpdateId,
      bids: orderBook.bids.slice(0, maxDepth),
      asks: orderBook.asks.slice(0, maxDepth),
    };
  }

  async getKlines(
    symbol: string,
    interval: KlineInterval,
    limit?: number,
  ): Promise<KlineDto[]> {
    const key = `klines:${symbol}:${interval}`;
    const data = await this.redis.lrange(key, 0, limit ? limit - 1 : 499);
    return data.map((item) => JSON.parse(item));
  }

  async getRecentTrades(symbol: string, limit?: number): Promise<RecentTradeDto[]> {
    const key = `trades:${symbol}`;
    const data = await this.redis.lrange(key, 0, limit ? limit - 1 : 499);
    return data.map((item) => JSON.parse(item));
  }
}
