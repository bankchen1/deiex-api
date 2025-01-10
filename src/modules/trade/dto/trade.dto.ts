import { IsString, IsNumber, IsEnum, IsOptional, Min, IsUUID } from 'class-validator';
import { OrderSide, OrderType, OrderStatus } from '../types/trade.types';

export class CreateOrderDto {
  @IsString()
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  type: OrderType;

  @IsString()
  price: string;

  @IsString()
  quantity: string;

  @IsNumber()
  @Min(1)
  leverage: number;

  @IsString()
  timeInForce: string;

  @IsOptional()
  @IsString()
  clientOrderId?: string;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  removeMargin?: number;
}

export class TradeQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsNumber()
  startTime?: number;

  @IsOptional()
  @IsNumber()
  endTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class OrderResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  type: OrderType;

  @IsString()
  price: string;

  @IsString()
  quantity: string;

  @IsNumber()
  leverage: number;

  @IsString()
  margin: string;

  @IsString()
  timeInForce: string;

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsString()
  filledQty: string;

  @IsOptional()
  @IsString()
  remainingQty?: string;

  createdAt: Date;
  updatedAt: Date;
}

export class TradeResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsString()
  amount: string;

  @IsString()
  price: string;

  @IsOptional()
  @IsNumber()
  profitPercent?: number;

  @IsOptional()
  @IsString()
  pnl?: string;

  @IsOptional()
  @IsString()
  fee?: string;

  createdAt: Date;
  updatedAt: Date;
}

export class PositionResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsString()
  quantity: string;

  @IsString()
  entryPrice: string;

  @IsNumber()
  leverage: number;

  @IsString()
  liquidationPrice: string;

  @IsString()
  margin: string;

  @IsString()
  unrealizedPnl: string;

  @IsString()
  realizedPnl: string;

  createdAt: Date;
  updatedAt: Date;
}

export class TradeHistoryDto {
  trades: TradeResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class TradeStatisticsDto {
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
}
