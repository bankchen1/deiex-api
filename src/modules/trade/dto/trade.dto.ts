import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  IsDateString,
  IsPositive,
  IsInt,
  Max,
} from 'class-validator';
import {
  OrderSide,
  OrderType,
  OrderStatus,
  OrderTimeInForce,
} from '../types/trade.types';

export class CreateOrderDto {
  @ApiProperty({ description: 'Trading pair symbol (e.g., BTC-USDT)' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderSide, description: 'Order side (buy/sell)' })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ enum: OrderType, description: 'Order type' })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ description: 'Order price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Order amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    enum: OrderTimeInForce,
    description: 'Time in force (GTC/IOC/FOK)',
  })
  @IsEnum(OrderTimeInForce)
  @IsOptional()
  timeInForce?: OrderTimeInForce;

  @ApiPropertyOptional({ description: 'Stop price for stop orders' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stopPrice?: number;

  @ApiPropertyOptional({ description: 'Client order ID' })
  @IsString()
  @IsOptional()
  clientOrderId?: string;

  @ApiPropertyOptional({ description: 'Leverage (1-100)', default: 1 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  leverage?: number = 1;

  @ApiPropertyOptional({ description: 'Stop loss price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stopLoss?: number;

  @ApiPropertyOptional({ description: 'Take profit price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  takeProfit?: number;
}

export class OrderResponseDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  clientOrderId?: string;

  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderSide })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsNumber()
  filled: number;

  @ApiProperty()
  @IsNumber()
  remaining: number;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ enum: OrderTimeInForce })
  @IsEnum(OrderTimeInForce)
  @IsOptional()
  timeInForce?: OrderTimeInForce;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  stopPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  leverage?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  margin?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  stopLoss?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  takeProfit?: number;

  @ApiProperty()
  @IsDateString()
  createdAt: Date;

  @ApiProperty()
  @IsDateString()
  updatedAt: Date;
}

export class TradeResponseDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsUUID()
  makerOrderId: string;

  @ApiProperty()
  @IsUUID()
  takerOrderId: string;

  @ApiProperty()
  @IsString()
  makerUserId: string;

  @ApiProperty()
  @IsString()
  takerUserId: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  leverage?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  profit?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  profitPercent?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  margin?: number;

  @ApiProperty()
  @IsDateString()
  createdAt: Date;
}

export class TradeQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  limit?: number = 50;
}

export class TradeHistoryDto {
  @ApiProperty({ type: [TradeResponseDto] })
  trades: TradeResponseDto[];

  @ApiProperty()
  @IsNumber()
  total: number;
}

export class TradeStatisticsDto {
  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  volume: number;

  @ApiProperty()
  @IsNumber()
  high: number;

  @ApiProperty()
  @IsNumber()
  low: number;

  @ApiProperty()
  @IsNumber()
  change: number;

  @ApiProperty()
  @IsNumber()
  changePercent: number;
}

export class UpdatePositionDto {
  @ApiPropertyOptional({ description: 'Stop loss price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stopLoss?: number;

  @ApiPropertyOptional({ description: 'Take profit price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  takeProfit?: number;

  @ApiPropertyOptional({ description: 'Add margin amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  addMargin?: number;

  @ApiPropertyOptional({ description: 'Remove margin amount' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  removeMargin?: number;
}

export class PositionResponseDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderSide })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsNumber()
  entryPrice: number;

  @ApiProperty()
  @IsNumber()
  markPrice: number;

  @ApiProperty()
  @IsNumber()
  leverage: number;

  @ApiProperty()
  @IsNumber()
  margin: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  stopLoss?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  takeProfit?: number;

  @ApiProperty()
  @IsNumber()
  liquidationPrice: number;

  @ApiProperty()
  @IsNumber()
  unrealizedPnl: number;

  @ApiProperty()
  @IsNumber()
  realizedPnl: number;

  @ApiProperty()
  @IsDateString()
  createdAt: Date;

  @ApiProperty()
  @IsDateString()
  updatedAt: Date;
}

export class OrderBookResponseDto {
  @ApiProperty({
    description: 'Bid orders sorted by price in descending order',
    type: 'array',
    items: {
      type: 'array',
      items: [
        { type: 'number', description: 'Price level' },
        { type: 'number', description: 'Quantity' },
        { type: 'number', description: 'Order count' },
      ],
    },
  })
  bids: [number, number, number][];

  @ApiProperty({
    description: 'Ask orders sorted by price in ascending order',
    type: 'array',
    items: {
      type: 'array',
      items: [
        { type: 'number', description: 'Price level' },
        { type: 'number', description: 'Quantity' },
        { type: 'number', description: 'Order count' },
      ],
    },
  })
  asks: [number, number, number][];

  @ApiProperty({ description: 'Last update ID of the order book' })
  lastUpdateId: number;
}
