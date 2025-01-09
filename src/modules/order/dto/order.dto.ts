import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, IsUUID, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP_LIMIT = 'STOP_LIMIT',
  STOP_MARKET = 'STOP_MARKET',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum TimeInForce {
  GTC = 'GTC', // Good Till Cancel
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK', // Fill or Kill
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Trading pair symbol', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderType, description: 'Order type' })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ enum: OrderSide, description: 'Order side' })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ description: 'Order quantity', example: '1.5' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ description: 'Order price (required for LIMIT orders)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiProperty({ description: 'Stop price (required for STOP orders)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  stopPrice?: number;

  @ApiProperty({ enum: TimeInForce, description: 'Time in force', required: false })
  @IsOptional()
  @IsEnum(TimeInForce)
  timeInForce?: TimeInForce = TimeInForce.GTC;

  @ApiProperty({ description: 'Client order ID', required: false })
  @IsOptional()
  @IsString()
  clientOrderId?: string;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Trading pair symbol' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderType })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ enum: OrderSide })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty()
  @IsNumber()
  price: number;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  filledQuantity: number;

  @ApiProperty()
  @IsNumber()
  remainingQuantity: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  stopPrice?: number;

  @ApiProperty()
  @IsEnum(TimeInForce)
  timeInForce: TimeInForce;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientOrderId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CancelOrderDto {
  @ApiProperty({ description: 'Order ID to cancel' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Trading pair symbol' })
  @IsString()
  symbol: string;
}

export class OrderQueryDto {
  @ApiProperty({ description: 'Trading pair symbol', required: false })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiProperty({ enum: OrderStatus, required: false })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({ enum: OrderSide, required: false })
  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;

  @ApiProperty({ description: 'Start time in milliseconds', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  startTime?: number;

  @ApiProperty({ description: 'End time in milliseconds', required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  endTime?: number;

  @ApiProperty({ description: 'Limit of results', required: false, default: 100 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 100;
}

export class OrderBookEntryDto {
  @ApiProperty({ description: 'Price level' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Quantity at price level' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Number of orders at price level' })
  @IsNumber()
  orderCount: number;
}

export class OrderMatchDto {
  @ApiProperty({ description: 'Maker order ID' })
  @IsUUID()
  makerOrderId: string;

  @ApiProperty({ description: 'Taker order ID' })
  @IsUUID()
  takerOrderId: string;

  @ApiProperty({ description: 'Match price' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Match quantity' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Match timestamp' })
  timestamp: Date;
}

export class OrderUpdateDto {
  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty()
  @IsNumber()
  filledQuantity: number;

  @ApiProperty()
  @IsNumber()
  remainingQuantity: number;

  @ApiProperty({ description: 'Last filled price', required: false })
  @IsOptional()
  @IsNumber()
  lastFilledPrice?: number;

  @ApiProperty({ description: 'Last filled quantity', required: false })
  @IsOptional()
  @IsNumber()
  lastFilledQuantity?: number;

  @ApiProperty()
  updatedAt: Date;
}

export class OrderWebSocketDto {
  @ApiProperty({ description: 'Event type', example: 'ORDER_UPDATE' })
  @IsString()
  event: string;

  @ApiProperty({ description: 'Order data' })
  data: OrderUpdateDto;
}
