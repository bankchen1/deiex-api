import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
}

export enum TimeInForce {
  GTC = 'GTC', // Good Till Cancel
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK', // Fill or Kill
}

export class CreateOrderDto {
  @IsString()
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  type: OrderType;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsNumber()
  leverage: number;

  @IsEnum(TimeInForce)
  timeInForce: TimeInForce;
}

export class OrderResponseDto {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  quantity: string;
  leverage: number;
  margin: string;
  timeInForce: TimeInForce;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PositionResponseDto {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  quantity: string;
  entryPrice: string;
  leverage: number;
  liquidationPrice: string;
  margin: string;
  unrealizedPnl: string;
  realizedPnl: string;
  createdAt: Date;
  updatedAt: Date;
}
