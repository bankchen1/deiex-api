import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

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

export class MarketEventData {
  @ApiProperty({ enum: ['depth', 'kline', 'ticker', 'trade'] })
  @IsEnum(['depth', 'kline', 'ticker', 'trade'])
  type: 'depth' | 'kline' | 'ticker' | 'trade';

  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  data: OrderBookDto | KlineDto | TickerDto | TradeDto;

  @ApiProperty()
  @IsNumber()
  timestamp: number;
}

export class TickerDto {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsString()
  price: string;

  @ApiProperty()
  @IsString()
  priceChange: string;

  @ApiProperty()
  @IsString()
  priceChangePercent: string;

  @ApiProperty()
  @IsString()
  volume: string;

  @ApiProperty()
  @IsString()
  quoteVolume: string;

  @ApiProperty()
  @IsString()
  high: string;

  @ApiProperty()
  @IsString()
  low: string;

  @ApiProperty()
  @IsString()
  openPrice: string;

  @ApiProperty()
  @IsNumber()
  timestamp: number;
}

export class OrderBookDto {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsNumber()
  lastUpdateId: number;

  @ApiProperty({ type: [Array] })
  @IsArray()
  bids: [string, string][];

  @ApiProperty({ type: [Array] })
  @IsArray()
  asks: [string, string][];

  @ApiProperty()
  @IsNumber()
  timestamp: number;
}

export class KlineDto {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsString()
  interval: string;

  @ApiProperty()
  @IsNumber()
  openTime: number;

  @ApiProperty()
  @IsString()
  open: string;

  @ApiProperty()
  @IsString()
  high: string;

  @ApiProperty()
  @IsString()
  low: string;

  @ApiProperty()
  @IsString()
  close: string;

  @ApiProperty()
  @IsString()
  volume: string;

  @ApiProperty()
  @IsNumber()
  closeTime: number;

  @ApiProperty()
  @IsString()
  quoteVolume: string;

  @ApiProperty()
  @IsNumber()
  trades: number;

  @ApiProperty()
  @IsString()
  takerBaseVolume: string;

  @ApiProperty()
  @IsString()
  takerQuoteVolume: string;

  @ApiProperty()
  @IsNumber()
  timestamp: number;
}

export class TradeDto {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsNumber()
  id: number;

  @ApiProperty()
  @IsString()
  price: string;

  @ApiProperty()
  @IsString()
  quantity: string;

  @ApiProperty()
  @IsString()
  quoteQuantity: string;

  @ApiProperty()
  @IsNumber()
  time: number;

  @ApiProperty()
  @IsBoolean()
  isBuyerMaker: boolean;

  @ApiProperty()
  @IsBoolean()
  isBestMatch: boolean;

  @ApiProperty()
  @IsNumber()
  timestamp: number;
}

export class MarketOverviewDto {
  @ApiProperty()
  btc: {
    @ApiProperty()
    @IsString()
    price: string;

    @ApiProperty()
    @IsString()
    priceChange: string;

    @ApiProperty()
    @IsString()
    priceChangePercent: string;

    @ApiProperty()
    @IsString()
    volume: string;
  };

  @ApiProperty()
  eth: {
    @ApiProperty()
    @IsString()
    price: string;

    @ApiProperty()
    @IsString()
    priceChange: string;

    @ApiProperty()
    @IsString()
    priceChangePercent: string;

    @ApiProperty()
    @IsString()
    volume: string;
  };
}

export class MarketStatusDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  markets: Array<{
    @ApiProperty()
    @IsString()
    symbol: string;

    @ApiProperty({ enum: ['online', 'offline', 'maintenance'] })
    @IsEnum(['online', 'offline', 'maintenance'])
    status: 'online' | 'offline' | 'maintenance';

    @ApiProperty()
    @IsString()
    baseAsset: string;

    @ApiProperty()
    @IsString()
    quoteAsset: string;
  }>;

  @ApiProperty()
  @IsNumber()
  serverTime: number;
}

export class RecentTradeDto extends TradeDto {}

export class KlineQueryDto {
  @ApiProperty({ enum: KlineInterval })
  @IsEnum(KlineInterval)
  interval: KlineInterval;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  startTime?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  endTime?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;
}

export class OrderBookQueryDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;
}

export class TradesQueryDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;
}

export class BookTickerDto {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsString()
  bidPrice: string;

  @ApiProperty()
  @IsString()
  bidQty: string;

  @ApiProperty()
  @IsString()
  askPrice: string;

  @ApiProperty()
  @IsString()
  askQty: string;
}
