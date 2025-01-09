import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, IsArray } from 'class-validator';
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

export class MarketOverviewDto {
  @ApiProperty({ description: 'Bitcoin market data' })
  btc: {
    @ApiProperty({ description: 'Price' })
    price: number;
    @ApiProperty({ description: '24h volume' })
    volume24h: number;
    @ApiProperty({ description: '24h price change' })
    priceChange24h: number;
  };

  @ApiProperty({ description: 'Ethereum market data' })
  eth: {
    @ApiProperty({ description: 'Price' })
    price: number;
    @ApiProperty({ description: '24h volume' })
    volume24h: number;
    @ApiProperty({ description: '24h price change' })
    priceChange24h: number;
  };

  @ApiProperty({ description: 'Timestamp of the data' })
  @IsNumber()
  timestamp: number;
}

export class TickerDto {
  @ApiProperty({ description: 'Trading pair symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: 'Current price' })
  @IsString()
  price: string;

  @ApiProperty({ description: 'Price change' })
  @IsString()
  priceChange: string;

  @ApiProperty({ description: 'Price change percent' })
  @IsString()
  priceChangePercent: string;

  @ApiProperty({ description: 'Trading volume' })
  @IsString()
  volume: string;

  @ApiProperty({ description: 'Quote asset volume' })
  @IsString()
  quoteVolume: string;

  @ApiProperty({ description: '24h high price' })
  @IsString()
  high: string;

  @ApiProperty({ description: '24h low price' })
  @IsString()
  low: string;

  @ApiProperty({ description: 'Data timestamp' })
  @IsNumber()
  timestamp: number;
}

export class OrderBookDto {
  @ApiProperty({ description: 'Trading pair symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: 'Bid orders', type: [Object] })
  @IsArray()
  @Type(() => Object)
  bids: Array<{ 
    @ApiProperty({ description: 'Price level' })
    price: string;
    @ApiProperty({ description: 'Quantity at price level' })
    quantity: string; 
  }>;

  @ApiProperty({ description: 'Ask orders', type: [Object] })
  @IsArray()
  @Type(() => Object)
  asks: Array<{ 
    @ApiProperty({ description: 'Price level' })
    price: string;
    @ApiProperty({ description: 'Quantity at price level' })
    quantity: string; 
  }>;

  @ApiProperty({ description: 'Data timestamp' })
  @IsNumber()
  timestamp: number;
}

export class KlineDto {
  @ApiProperty({ description: 'Opening time' })
  @IsNumber()
  openTime: number;

  @ApiProperty({ description: 'Opening price' })
  @IsString()
  open: string;

  @ApiProperty({ description: 'Highest price' })
  @IsString()
  high: string;

  @ApiProperty({ description: 'Lowest price' })
  @IsString()
  low: string;

  @ApiProperty({ description: 'Closing price' })
  @IsString()
  close: string;

  @ApiProperty({ description: 'Trading volume' })
  @IsString()
  volume: string;

  @ApiProperty({ description: 'Closing time' })
  @IsNumber()
  closeTime: number;

  @ApiProperty({ description: 'Quote asset volume' })
  @IsString()
  quoteAssetVolume: string;

  @ApiProperty({ description: 'Number of trades' })
  @IsNumber()
  trades: number;

  @ApiProperty({ description: 'Taker buy base asset volume' })
  @IsString()
  takerBuyBaseAssetVolume: string;

  @ApiProperty({ description: 'Taker buy quote asset volume' })
  @IsString()
  takerBuyQuoteAssetVolume: string;
}

export class KlineQueryDto {
  @ApiProperty({ enum: KlineInterval, description: 'Kline/candlestick interval' })
  @IsEnum(KlineInterval)
  interval: KlineInterval;

  @ApiProperty({ required: false, description: 'Start time in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  startTime?: number;

  @ApiProperty({ required: false, description: 'End time in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  endTime?: number;

  @ApiProperty({ required: false, description: 'Limit of results', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;
}

export class OrderBookQueryDto {
  @ApiProperty({ required: false, description: 'Limit of results', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;
}

export class BookTickerDto {
  @ApiProperty({ description: 'Trading pair symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: 'Best bid price' })
  @IsString()
  bidPrice: string;

  @ApiProperty({ description: 'Best bid quantity' })
  @IsString()
  bidQty: string;

  @ApiProperty({ description: 'Best ask price' })
  @IsString()
  askPrice: string;

  @ApiProperty({ description: 'Best ask quantity' })
  @IsString()
  askQty: string;
}

export class RecentTradeDto {
  @ApiProperty({ description: 'Trade ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Trade price' })
  @IsString()
  price: string;

  @ApiProperty({ description: 'Trade quantity' })
  @IsString()
  quantity: string;

  @ApiProperty({ description: 'Trade timestamp' })
  @IsNumber()
  timestamp: number;

  @ApiProperty({ description: 'Whether the buyer is the market maker' })
  @IsBoolean()
  isBuyerMaker: boolean;
}

export class MarketStatusDto {
  @ApiProperty({ description: 'Market status information', type: [Object] })
  @IsArray()
  @Type(() => Object)
  markets: Array<{
    @ApiProperty({ description: 'Market symbol' })
    symbol: string;
    @ApiProperty({ description: 'Market status' })
    status: string;
    @ApiProperty({ description: 'Last update time' })
    lastUpdate: number;
  }>;

  @ApiProperty({ description: 'Server time' })
  @IsNumber()
  serverTime: number;
}

export class TradesQueryDto {
  @ApiProperty({ required: false, description: 'Limit of results', default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  @Type(() => Number)
  limit?: number;
}
