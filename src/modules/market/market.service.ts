import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TickerDto } from './dto/ticker.dto';
import { KlineDto } from './dto/kline.dto';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly MARKET_STATUS_KEY = 'market:status';
  private readonly SUBSCRIPTION_PREFIX = 'market:sub:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getKlines(
    symbol: string,
    interval: string,
    limit: number,
  ): Promise<KlineDto[]> {
    // 从数据库中获取K线数据
    const klines = await this.prisma.kline.findMany({
      where: {
        symbol,
        interval,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });

    // 将数据转换为Kline类型并返回
    return klines.map((kline) => ({
      openTime: kline.timestamp,
      open: kline.open.toString(),
      high: kline.high.toString(),
      low: kline.low.toString(),
      close: kline.close.toString(),
      volume: kline.volume.toString(),
      closeTime: kline.timestamp,
      quoteAssetVolume: '0',
      trades: 0,
      takerBuyBaseAssetVolume: '0',
      takerBuyQuoteAssetVolume: '0',
    }));
  }

  async getLatestPrice(symbol: string): Promise<number> {
    // 获取最新的K线数据
    const latestKline = await this.prisma.kline.findFirst({
      where: {
        symbol,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!latestKline) {
      throw new Error(`没有找到${symbol}的价格数据`);
    }

    return latestKline.close;
  }

  async getSymbols(): Promise<string[]> {
    // 获取所有可用的交易对
    const symbols = await this.prisma.symbol.findMany({
      where: {
        isActive: true,
      },
      select: {
        name: true,
      },
    });

    return symbols.map((symbol) => symbol.name);
  }

  async getIntervals(): Promise<string[]> {
    // 返回支持的时间间隔
    return [
      '1m',
      '3m',
      '5m',
      '15m',
      '30m',
      '1h',
      '2h',
      '4h',
      '6h',
      '8h',
      '12h',
      '1d',
      '3d',
      '1w',
      '1M',
    ];
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    // 验证交易对是否存在且可用
    const symbolExists = await this.prisma.symbol.findFirst({
      where: {
        name: symbol,
        isActive: true,
      },
    });

    return !!symbolExists;
  }

  async validateInterval(interval: string): Promise<boolean> {
    // 验证时间间隔是否有效
    const validIntervals = await this.getIntervals();
    return validIntervals.includes(interval);
  }

  async getMarketStatus(): Promise<any> {
    const status = await this.redisService.get(this.MARKET_STATUS_KEY);
    if (!status) {
      return {
        status: 'running',
        timestamp: Date.now(),
      };
    }
    return JSON.parse(status);
  }

  async getMarketOverview(): Promise<any> {
    // Implementation
    return {
      totalVolume: '0',
      totalTrades: 0,
      topGainers: [],
      topLosers: [],
    };
  }

  async getTickerPrice(symbol: string): Promise<TickerDto> {
    // Implementation
    return {
      symbol,
      price: '0',
      priceChange: '0',
      priceChangePercent: '0',
      volume: '0',
      quoteVolume: '0',
      high: '0',
      low: '0',
      openPrice: '0',
    };
  }

  async getAllTickers(): Promise<TickerDto[]> {
    // Implementation
    return [];
  }

  async getOrderBook(symbol: string, options: any): Promise<any> {
    // Implementation
    return {
      symbol,
      bids: [],
      asks: [],
      timestamp: new Date(),
    };
  }

  async getKlineData(symbol: string, options?: any): Promise<KlineDto[]> {
    // Implementation
    return [];
  }

  async getTickerData(symbol: string): Promise<any> {
    // Implementation
    return {
      symbol,
      price: '0',
      volume: '0',
      change: '0',
      timestamp: new Date(),
    };
  }

  async getRecentTrades(symbol: string, limit: number): Promise<any> {
    // Implementation
    return [];
  }

  async getServerStatus(): Promise<any> {
    // Implementation
    return {
      status: 'ONLINE',
      timestamp: new Date(),
    };
  }

  async subscribeToMarketData(clientId: string, symbol: string, channel: string): Promise<void> {
    const subscriptionKey = `${this.SUBSCRIPTION_PREFIX}${clientId}:${symbol}:${channel}`;
    await this.redisService.set(subscriptionKey, 'active');
    
    // 发送事件通知其他服务
    this.eventEmitter.emit('market.subscribe', {
      clientId,
      symbol,
      channel,
    });
  }

  async unsubscribeFromMarketData(clientId: string): Promise<void> {
    // 获取客户端的所有订阅
    const pattern = `${this.SUBSCRIPTION_PREFIX}${clientId}:*`;
    const keys = await this.redisService.getClient().keys(pattern);
    
    // 删除所有订阅
    if (keys.length > 0) {
      await this.redisService.getClient().del(...keys);
    }

    // 发送事件通知其他服务
    this.eventEmitter.emit('market.unsubscribe', { clientId });
  }

  async updateMarketStatus(status: string): Promise<void> {
    const marketStatus = {
      status,
      timestamp: Date.now(),
    };
    await this.redisService.set(this.MARKET_STATUS_KEY, JSON.stringify(marketStatus));
  }

  async getTicker(symbol: string): Promise<TickerDto> {
    const key = `ticker:${symbol}`;
    const cachedData = await this.redisService.get(key);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const ticker = await this.prisma.ticker.findUnique({
      where: { symbol },
    });

    if (!ticker) {
      return {
        symbol,
        price: '0',
        priceChange: '0',
        priceChangePercent: '0',
        volume: '0',
        quoteVolume: '0',
        high: '0',
        low: '0',
        openPrice: '0',
      };
    }

    const tickerDto: TickerDto = {
      symbol: ticker.symbol,
      price: ticker.price.toString(),
      priceChange: ticker.priceChange.toString(),
      priceChangePercent: ticker.priceChangePercent.toString(),
      volume: ticker.volume.toString(),
      quoteVolume: ticker.quoteVolume.toString(),
      high: ticker.high.toString(),
      low: ticker.low.toString(),
      openPrice: ticker.openPrice.toString(),
    };

    await this.redisService.set(key, JSON.stringify(tickerDto), 60); // Cache for 60 seconds
    return tickerDto;
  }

  async getTickers(): Promise<TickerDto[]> {
    const key = 'tickers:all';
    const cachedData = await this.redisService.get(key);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const tickers = await this.prisma.ticker.findMany();
    const tickerDtos = tickers.map(ticker => ({
      symbol: ticker.symbol,
      price: ticker.price.toString(),
      priceChange: ticker.priceChange.toString(),
      priceChangePercent: ticker.priceChangePercent.toString(),
      volume: ticker.volume.toString(),
      quoteVolume: ticker.quoteVolume.toString(),
      high: ticker.high.toString(),
      low: ticker.low.toString(),
      openPrice: ticker.openPrice.toString(),
    }));

    await this.redisService.set(key, JSON.stringify(tickerDtos), 60); // Cache for 60 seconds
    return tickerDtos;
  }

  async getKline(symbol: string, interval: string, limit?: number): Promise<KlineDto[]> {
    const key = `kline:${symbol}:${interval}:${limit || 500}`;
    const cachedData = await this.redisService.get(key);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const klines = await this.prisma.kline.findMany({
      where: {
        symbol,
        interval,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit || 500,
    });

    const klineDtos = klines.map(kline => ({
      openTime: kline.timestamp,
      open: kline.open.toString(),
      high: kline.high.toString(),
      low: kline.low.toString(),
      close: kline.close.toString(),
      volume: kline.volume.toString(),
      closeTime: kline.timestamp + parseInt(interval) * 60 * 1000,
      quoteAssetVolume: kline.quoteVolume.toString(),
      trades: kline.trades,
      takerBuyBaseAssetVolume: kline.takerBuyVolume.toString(),
      takerBuyQuoteAssetVolume: kline.takerBuyQuoteVolume.toString(),
    }));

    await this.redisService.set(key, JSON.stringify(klineDtos), 60); // Cache for 60 seconds
    return klineDtos;
  }
}
