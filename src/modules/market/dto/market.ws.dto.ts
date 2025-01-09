import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum WsChannel {
  TICKER = 'ticker',
  KLINE = 'kline',
  ORDERBOOK = 'orderbook',
  TRADE = 'trade',
}

export class WsSubscribeDto {
  @ApiProperty({ description: 'Trading pair symbol', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: WsChannel, description: 'Subscription channel' })
  @IsEnum(WsChannel)
  channel: WsChannel;

  @ApiProperty({ description: 'Additional parameters for subscription', required: false })
  @IsOptional()
  params?: Record<string, any>;
}

export class WsUnsubscribeDto {
  @ApiProperty({ description: 'Trading pair symbol', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: WsChannel, description: 'Channel to unsubscribe from' })
  @IsEnum(WsChannel)
  channel: WsChannel;
}

export interface WsErrorResponse {
  code: number;
  message: string;
}

export interface WsSuccessResponse {
  symbol?: string;
  channel?: string;
  message: string;
}

export interface WsTickerUpdate {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  high: string;
  low: string;
  timestamp: number;
}

export interface WsKlineUpdate {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  close: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  trades: number;
}

export interface WsOrderBookUpdate {
  symbol: string;
  bids: [string, string][]; // [price, quantity][]
  asks: [string, string][]; // [price, quantity][]
  timestamp: number;
}

export interface WsTradeUpdate {
  symbol: string;
  id: string;
  price: string;
  quantity: string;
  timestamp: number;
  isBuyerMaker: boolean;
}
