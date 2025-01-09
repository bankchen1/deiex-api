import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Kline } from '../strategy/types/kline.type';

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  async getKlines(
    symbol: string,
    interval: string,
    limit: number,
  ): Promise<Kline[]> {
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
      symbol: kline.symbol,
      interval: kline.interval,
      timestamp: kline.timestamp,
      open: kline.open.toString(),
      high: kline.high.toString(),
      low: kline.low.toString(),
      close: kline.close.toString(),
      volume: kline.volume.toString(),
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

    return Number(latestKline.close);
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
}
