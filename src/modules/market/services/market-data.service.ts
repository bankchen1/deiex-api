import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';

interface KlineData {
  symbol: string;
  interval: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

interface TickerData {
  symbol: string;
  price: number;
  volume: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  lastUpdateTime: number;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly klineIntervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  private readonly updateIntervals: { [key: string]: number } = {
    ticker: 1000,    // 1秒
    kline: 1000,     // 1秒
    depth: 100,      // 100毫秒
  };

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.initializeMarketData();
  }

  private async initializeMarketData() {
    // 初始化所有交易对的行情数据
    const tradingPairs = await this.prisma.tradingPair.findMany({
      where: { isActive: true },
    });

    for (const pair of tradingPairs) {
      // 初始化K线数据
      await this.initializeKlineData(pair.symbol);
      
      // 初始化24小时行情
      await this.initialize24hTicker(pair.symbol);
      
      // 启动定时更新任务
      this.startUpdateTasks(pair.symbol);
    }
  }

  private async initializeKlineData(symbol: string) {
    for (const interval of this.klineIntervals) {
      const key = `kline:${symbol}:${interval}`;
      const exists = await this.redis.exists(key);
      
      if (!exists) {
        // 从数据库加载历史K线数据
        const klines = await this.prisma.kline.findMany({
          where: {
            symbol,
            interval,
          },
          orderBy: {
            openTime: 'desc',
          },
          take: 1000, // 保留最近1000根K线
        });

        if (klines.length > 0) {
          await this.redis.pipeline(
            klines.map(kline => ['zadd', key, kline.openTime, JSON.stringify(kline)])
          ).exec();
        }
      }
    }
  }

  private async initialize24hTicker(symbol: string) {
    const key = `ticker:${symbol}`;
    const exists = await this.redis.exists(key);
    
    if (!exists) {
      // 计算24小时行情数据
      const ticker = await this.calculate24hTicker(symbol);
      await this.redis.set(key, JSON.stringify(ticker));
    }
  }

  private startUpdateTasks(symbol: string) {
    // 更新Ticker
    setInterval(async () => {
      try {
        await this.updateTicker(symbol);
      } catch (error) {
        this.logger.error(`Error updating ticker for ${symbol}: ${error.message}`);
        this.prometheusService.incrementErrors('ticker_update_error');
      }
    }, this.updateIntervals.ticker);

    // 更新K线
    setInterval(async () => {
      try {
        await this.updateKline(symbol);
      } catch (error) {
        this.logger.error(`Error updating kline for ${symbol}: ${error.message}`);
        this.prometheusService.incrementErrors('kline_update_error');
      }
    }, this.updateIntervals.kline);
  }

  private async updateTicker(symbol: string) {
    const startTime = Date.now();
    try {
      const ticker = await this.calculate24hTicker(symbol);
      
      // 更新Redis缓存
      await this.redis.set(`ticker:${symbol}`, JSON.stringify(ticker));
      
      // 发送更新事件
      this.eventEmitter.emit('ticker.updated', ticker);
      
      // 记录性能指标
      this.prometheusService.recordLatency('ticker_update', Date.now() - startTime);
    } catch (error) {
      throw error;
    }
  }

  private async updateKline(symbol: string) {
    const startTime = Date.now();
    try {
      for (const interval of this.klineIntervals) {
        const kline = await this.calculateCurrentKline(symbol, interval);
        
        // 更新Redis缓存
        const key = `kline:${symbol}:${interval}`;
        await this.redis.zadd(key, kline.openTime, JSON.stringify(kline));
        
        // 维护固定大小的数据集
        await this.redis.zremrangebyrank(key, 0, -1001); // 保留最新的1000条
        
        // 发送更新事件
        this.eventEmitter.emit('kline.updated', {
          symbol,
          interval,
          data: kline,
        });
      }
      
      // 记录性能指标
      this.prometheusService.recordLatency('kline_update', Date.now() - startTime);
    } catch (error) {
      throw error;
    }
  }

  private async calculate24hTicker(symbol: string): Promise<TickerData> {
    const now = Date.now();
    const before24h = now - 24 * 60 * 60 * 1000;

    const trades = await this.prisma.trade.findMany({
      where: {
        symbol,
        timestamp: {
          gte: new Date(before24h),
          lte: new Date(now),
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (trades.length === 0) {
      return {
        symbol,
        price: 0,
        volume: 0,
        high24h: 0,
        low24h: 0,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        lastUpdateTime: now,
      };
    }

    const firstPrice = trades[0].price;
    const lastPrice = trades[trades.length - 1].price;
    const volume = trades.reduce((sum, trade) => sum + trade.amount, 0);
    const high24h = Math.max(...trades.map(trade => trade.price));
    const low24h = Math.min(...trades.map(trade => trade.price));
    const priceChange24h = lastPrice - firstPrice;
    const priceChangePercent24h = (priceChange24h / firstPrice) * 100;

    return {
      symbol,
      price: lastPrice,
      volume,
      high24h,
      low24h,
      priceChange24h,
      priceChangePercent24h,
      lastUpdateTime: now,
    };
  }

  private async calculateCurrentKline(symbol: string, interval: string): Promise<KlineData> {
    const intervalMs = this.getIntervalMilliseconds(interval);
    const now = Date.now();
    const openTime = Math.floor(now / intervalMs) * intervalMs;
    const closeTime = openTime + intervalMs - 1;

    const trades = await this.prisma.trade.findMany({
      where: {
        symbol,
        timestamp: {
          gte: new Date(openTime),
          lte: new Date(closeTime),
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (trades.length === 0) {
      // 如果没有交易，使用上一个K线的收盘价
      const lastKline = await this.getLastKline(symbol, interval);
      return {
        symbol,
        interval,
        openTime,
        open: lastKline?.close || 0,
        high: lastKline?.close || 0,
        low: lastKline?.close || 0,
        close: lastKline?.close || 0,
        volume: 0,
        closeTime,
      };
    }

    const open = trades[0].price;
    const close = trades[trades.length - 1].price;
    const high = Math.max(...trades.map(trade => trade.price));
    const low = Math.min(...trades.map(trade => trade.price));
    const volume = trades.reduce((sum, trade) => sum + trade.amount, 0);

    return {
      symbol,
      interval,
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime,
    };
  }

  private async getLastKline(symbol: string, interval: string): Promise<KlineData | null> {
    const key = `kline:${symbol}:${interval}`;
    const lastKline = await this.redis.zrevrange(key, 0, 0);
    return lastKline.length > 0 ? JSON.parse(lastKline[0]) : null;
  }

  private getIntervalMilliseconds(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: throw new Error('Invalid interval');
    }
  }

  // 公共API方法
  async getKlineData(symbol: string, interval: string = '1m', limit: number = 100): Promise<KlineData[]> {
    const key = `kline:${symbol}:${interval}`;
    const data = await this.redis.zrevrange(key, 0, limit - 1);
    return data.map(item => JSON.parse(item));
  }

  async getTickerData(symbol: string): Promise<TickerData> {
    const data = await this.redis.get(`ticker:${symbol}`);
    return data ? JSON.parse(data) : null;
  }

  async getMarketStatus(): Promise<any> {
    const tradingPairs = await this.prisma.tradingPair.findMany({
      where: { isActive: true },
    });

    const status = await Promise.all(
      tradingPairs.map(async pair => ({
        symbol: pair.symbol,
        ticker: await this.getTickerData(pair.symbol),
      }))
    );

    return {
      timestamp: Date.now(),
      markets: status,
    };
  }
}
