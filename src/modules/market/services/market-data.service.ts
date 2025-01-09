import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../modules/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../../shared/services/prometheus.service';
import { RedisService } from '../../../modules/redis/redis.service';

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
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.initializeMarketData();
  }

  private async initializeMarketData() {
    // 初始化所有交易对的行情数据
    const symbols = await this.getSymbols();
    
    for (const symbol of symbols) {
      await Promise.all([
        this.initializeKlineData(symbol),
        this.initializeTickerData(symbol),
      ]);
    }

    // 启动定时更新任务
    this.startUpdateTasks();
  }

  private async initializeKlineData(symbol: string) {
    const redis = this.redisService.getClient();
    
    for (const interval of this.klineIntervals) {
      const key = `kline:${symbol}:${interval}`;
      const exists = await redis.exists(key);
      
      if (!exists) {
        const klines = await this.prisma.kline.findMany({
          where: { symbol, interval },
          orderBy: { timestamp: 'desc' },
          take: 1000,
        });

        if (klines.length > 0) {
          await redis.set(key, JSON.stringify(klines));
        }
      }
    }
  }

  private async initializeTickerData(symbol: string) {
    const redis = this.redisService.getClient();
    const key = `ticker:${symbol}`;
    const exists = await redis.exists(key);
    
    if (!exists) {
      const ticker = await this.calculateTickerData(symbol);
      if (ticker) {
        await redis.set(key, JSON.stringify(ticker));
      }
    }
  }

  private startUpdateTasks() {
    // 启动K线更新任务
    setInterval(() => this.updateKlineData(), this.updateIntervals.kline);
    
    // 启动行情更新任务
    setInterval(() => this.updateTickerData(), this.updateIntervals.ticker);
  }

  private async updateKlineData() {
    const symbols = await this.getSymbols();
    const redis = this.redisService.getClient();
    
    for (const symbol of symbols) {
      try {
        for (const interval of this.klineIntervals) {
          const key = `kline:${symbol}:${interval}`;
          const latestKline = await this.getLatestKline(symbol, interval);
          
          if (latestKline) {
            await redis.set(key, JSON.stringify(latestKline));
            
            // 发送K线更新事件
            this.eventEmitter.emit('kline.updated', {
              symbol,
              interval,
              data: latestKline,
            });
            
            // 更新指标
            this.prometheusService.incrementKlineUpdates(symbol, interval);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to update kline data for ${symbol}: ${error.message}`);
      }
    }
  }

  private async updateTickerData() {
    const symbols = await this.getSymbols();
    const redis = this.redisService.getClient();
    
    for (const symbol of symbols) {
      try {
        const ticker = await this.calculateTickerData(symbol);
        if (ticker) {
          const key = `ticker:${symbol}`;
          await redis.set(key, JSON.stringify(ticker));
          
          // 发送Ticker更新事件
          this.eventEmitter.emit('ticker.updated', {
            symbol,
            data: ticker,
          });
          
          // 更新指标
          this.prometheusService.incrementTickerUpdates(symbol);
        }
      } catch (error) {
        this.logger.error(`Failed to update ticker data for ${symbol}: ${error.message}`);
      }
    }
  }

  private async getLatestKline(symbol: string, interval: string): Promise<KlineData | null> {
    const kline = await this.prisma.kline.findFirst({
      where: { symbol, interval },
      orderBy: { timestamp: 'desc' },
    });

    if (!kline) return null;

    return {
      symbol: kline.symbol,
      interval: kline.interval,
      openTime: kline.timestamp,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
      closeTime: kline.timestamp + this.getIntervalMilliseconds(interval),
    };
  }

  private async calculateTickerData(symbol: string): Promise<TickerData | null> {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const [latestKline, dayKlines] = await Promise.all([
      this.prisma.kline.findFirst({
        where: { symbol },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.kline.findMany({
        where: {
          symbol,
          timestamp: { gte: oneDayAgo },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    if (!latestKline || dayKlines.length === 0) return null;

    const high24h = Math.max(...dayKlines.map(k => k.high));
    const low24h = Math.min(...dayKlines.map(k => k.low));
    const volume24h = dayKlines.reduce((sum, k) => sum + k.volume, 0);
    const openPrice = dayKlines[dayKlines.length - 1].open;
    const currentPrice = latestKline.close;
    const priceChange = currentPrice - openPrice;
    const priceChangePercent = (priceChange / openPrice) * 100;

    return {
      symbol,
      price: currentPrice,
      volume: volume24h,
      high24h,
      low24h,
      priceChange24h: priceChange,
      priceChangePercent24h: priceChangePercent,
      lastUpdateTime: now,
    };
  }

  private getIntervalMilliseconds(interval: string): number {
    const unit = interval.slice(-1);
    const value = parseInt(interval.slice(0, -1));
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  private async getSymbols(): Promise<string[]> {
    const symbols = await this.prisma.symbol.findMany({
      where: { status: 'TRADING' },
      select: { name: true },
    });
    return symbols.map(s => s.name);
  }
}
