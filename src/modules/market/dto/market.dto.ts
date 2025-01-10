import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class MarketOverviewDto {
  btc: {
    price: string;
    priceChangePercent: string;
  };
}

export class TickerDto {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  count: number;
}

export class OrderBookDto {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export class OrderBookQueryDto {
  @IsString()
  symbol: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class KlineDto {
  symbol: string;
  interval: string;
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBaseVolume: string;
  takerQuoteVolume: string;
}

export enum KlineInterval {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1M'
}

export class KlineQueryDto {
  @IsString()
  symbol: string;

  @IsEnum(KlineInterval)
  interval: KlineInterval;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class RecentTradeDto {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}
