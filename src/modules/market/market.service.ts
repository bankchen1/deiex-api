import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TickerDto } from './dto/ticker.dto';
import { KlineDto } from './dto/kline.dto';
import { OrderBookDto } from './dto/order-book.dto';
import { TradeDto } from './dto/trade.dto';
import { MarketOverviewDto } from './dto/market-overview.dto';
import { MarketStatusDto } from './dto/market-status.dto';
import { KlineInterval } from './types/kline-interval.type';
import { NotFoundException } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly MARKET_STATUS_KEY = 'market:status';
  private readonly SUBSCRIPTION_PREFIX = 'market:sub:';
  private readonly ORDER_BOOK_PREFIX = 'market:orderbook:';
  private readonly TICKER_PREFIX = 'market:ticker:';
  private readonly KLINE_PREFIX = 'market:kline:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getKlines(
    symbol: string,
    interval: KlineInterval,
    limit: number,
  ): Promise<KlineDto[]> {
    try {
      const klineKey = `kline:${symbol}:${interval}`;
      const klineData = await this.redisService.zrevrange(klineKey, 0, limit - 1);
      
      return klineData.map(data => {
        const kline = JSON.parse(data);
        return {
          ...kline,
          symbol,
          interval,
          timestamp: Date.now(),
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get klines for ${symbol}`, error.stack);
      throw error;
    }
  }

  async getLatestPrice(symbol: string): Promise<number> {
    try {
      const cachedPrice = await this.redisService.get(`${this.TICKER_PREFIX}${symbol}`);
      if (cachedPrice) {
        return Number(cachedPrice);
      }

      const latestKline = await this.prisma.kline.findFirst({
        where: {
          symbol,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (!latestKline) {
        throw new Error(`No price data found for ${symbol}`);
      }

      await this.redisService.set(
        `${this.TICKER_PREFIX}${symbol}`,
        latestKline.close.toString(),
        'EX',
        60,
      );

      return latestKline.close;
    } catch (error) {
      this.logger.error(`Failed to get latest price for ${symbol}`, error.stack);
      throw error;
    }
  }

  async getSymbols(): Promise<string[]> {
    try {
      const symbols = await this.prisma.symbol.findMany({
        where: {
          isActive: true,
        },
        select: {
          name: true,
        },
      });

      return symbols.map((symbol) => symbol.name);
    } catch (error) {
      this.logger.error('Failed to get symbols', error.stack);
      throw error;
    }
  }

  async getIntervals(): Promise<KlineInterval[]> {
    return [
      '1m', '3m', '5m', '15m', '30m',
      '1h', '2h', '4h', '6h', '8h', '12h',
      '1d', '3d', '1w', '1M',
    ];
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const symbolExists = await this.prisma.symbol.findFirst({
        where: {
          name: symbol,
          isActive: true,
        },
      });

      return !!symbolExists;
    } catch (error) {
      this.logger.error(`Failed to validate symbol ${symbol}`, error.stack);
      throw error;
    }
  }

  async validateInterval(interval: string): Promise<boolean> {
    const validIntervals = await this.getIntervals();
    return validIntervals.includes(interval as KlineInterval);
  }

  async getMarketStatus(): Promise<MarketStatusDto> {
    try {
      const status = await this.redisService.get(this.MARKET_STATUS_KEY);
      if (!status) {
        return {
          status: 'running',
          timestamp: Date.now(),
          maintenance: false,
          message: null,
        };
      }
      return JSON.parse(status);
    } catch (error) {
      this.logger.error('Failed to get market status', error.stack);
      throw error;
    }
  }

  async getMarketOverview(): Promise<MarketOverviewDto> {
    try {
      const btcTicker = await this.getTicker('BTC-USDT');
      const ethTicker = await this.getTicker('ETH-USDT');

      return {
        btc: {
          price: btcTicker.price,
          priceChange: btcTicker.priceChange,
          priceChangePercent: btcTicker.priceChangePercent,
          volume: btcTicker.volume,
        },
        eth: {
          price: ethTicker.price,
          priceChange: ethTicker.priceChange,
          priceChangePercent: ethTicker.priceChangePercent,
          volume: ethTicker.volume,
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get market overview: ${error.message}`);
      throw new InternalServerErrorException('Failed to get market overview');
    }
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    try {
      const tickerData = await this.redisService.get(`ticker:${symbol}`);
      if (!tickerData) {
        throw new NotFoundException(`Ticker data not found for symbol: ${symbol}`);
      }
      const ticker = JSON.parse(tickerData);
      return {
        ...ticker,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Failed to get ticker: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAllTickers(): Promise<TickerDto[]> {
    try {
      const tickers = await this.redisService.keys('ticker:*');
      const tickerPromises = tickers.map(async (key) => {
        const tickerData = await this.redisService.get(key);
        if (tickerData) {
          const ticker = JSON.parse(tickerData);
          return {
            ...ticker,
            timestamp: Date.now(),
          };
        }
        return null;
      });

      const results = await Promise.all(tickerPromises);
      return results.filter((ticker): ticker is TickerDto => ticker !== null);
    } catch (error) {
      this.logger.error(`Failed to get all tickers: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getOrderBook(
    symbol: string,
    limit: number = 100,
  ): Promise<OrderBookDto> {
    try {
      const orderBookKey = `orderbook:${symbol}`;
      const orderBookData = await this.redisService.hGetAll(orderBookKey);

      if (!orderBookData || !orderBookData.bids || !orderBookData.asks) {
        throw new NotFoundException(`Order book not found for symbol ${symbol}`);
      }

      const bids = JSON.parse(orderBookData.bids).slice(0, limit);
      const asks = JSON.parse(orderBookData.asks).slice(0, limit);

      return {
        symbol,
        lastUpdateId: parseInt(orderBookData.lastUpdateId),
        bids: bids.map(([price, quantity]: string[]) => [price, quantity]),
        asks: asks.map(([price, quantity]: string[]) => [price, quantity]),
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error(`Failed to get order book for ${symbol}: ${error.message}`);
      throw error;
    }
  }

  async getRecentTrades(symbol: string, limit: number = 100): Promise<TradeDto[]> {
    try {
      const tradesKey = `trades:${symbol}`;
      const tradesData = await this.redisService.zrevrange(tradesKey, 0, limit - 1);
      
      return tradesData.map(data => {
        const trade = JSON.parse(data);
        return {
          ...trade,
          symbol,
          timestamp: Date.now(),
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get recent trades for ${symbol}`, error.stack);
      throw error;
    }
  }

  private processOrderBookData(
    orderBook: any,
    limit: number,
  ): { bids: [string, string][]; asks: [string, string][] } {
    const bids = orderBook.bids
      .slice(0, limit)
      .map(([price, qty]: [string, string]) => [price, qty]);
    const asks = orderBook.asks
      .slice(0, limit)
      .map(([price, qty]: [string, string]) => [price, qty]);
    return { bids, asks };
  }

  private async getAllMarkets(): Promise<Array<{
    symbol: string;
    status: 'online' | 'offline' | 'maintenance';
    baseAsset: string;
    quoteAsset: string;
  }>> {
    const marketsData = await this.redisService.get('markets:info');
    if (!marketsData) {
      return [];
    }
    return JSON.parse(marketsData);
  }
}
