import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP_LOSS = 'STOP_LOSS',
  TAKE_PROFIT = 'TAKE_PROFIT',
}

export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum PositionSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export class CreateOrderDto {
  @ApiProperty({ description: '交易对', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderSide, description: '订单方向' })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ enum: OrderType, description: '订单类型' })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ description: '数量', example: '0.01' })
  @IsString()
  quantity: string;

  @ApiProperty({ description: '价格 (市价单可不传)', required: false, example: '30000' })
  @IsString()
  @IsOptional()
  price?: string;

  @ApiProperty({ description: '触发价格 (止盈止损单必传)', required: false })
  @IsString()
  @IsOptional()
  stopPrice?: string;

  @ApiProperty({ description: '杠杆倍数', example: '10' })
  @IsNumber()
  leverage: number;

  @ApiProperty({ description: '是否减仓', default: false })
  @IsOptional()
  reduceOnly?: boolean;

  @ApiProperty({ description: '客户端订单ID', required: false })
  @IsString()
  @IsOptional()
  clientOrderId?: string;
}

export class OrderDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '交易对' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderSide, description: '订单方向' })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ enum: OrderType, description: '订单类型' })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ description: '原始数量' })
  @IsString()
  origQty: string;

  @ApiProperty({ description: '已成交数量' })
  @IsString()
  executedQty: string;

  @ApiProperty({ description: '价格' })
  @IsString()
  price: string;

  @ApiProperty({ description: '触发价格', required: false })
  @IsString()
  @IsOptional()
  stopPrice?: string;

  @ApiProperty({ description: '杠杆倍数' })
  @IsNumber()
  leverage: number;

  @ApiProperty({ enum: OrderStatus, description: '订单状态' })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiProperty({ description: '是否减仓' })
  @IsBoolean()
  reduceOnly: boolean;

  @ApiProperty({ description: '客户端订单ID', required: false })
  @IsString()
  @IsOptional()
  clientOrderId?: string;

  @ApiProperty({ description: '创建时间' })
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @Type(() => Date)
  updatedAt: Date;
}

export class PositionDto {
  @ApiProperty({ description: '仓位ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '交易对' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: PositionSide, description: '仓位方向' })
  @IsEnum(PositionSide)
  side: PositionSide;

  @ApiProperty({ description: '持仓数量' })
  @IsString()
  quantity: string;

  @ApiProperty({ description: '开仓均价' })
  @IsString()
  entryPrice: string;

  @ApiProperty({ description: '标记价格' })
  @IsString()
  markPrice: string;

  @ApiProperty({ description: '清算价格' })
  @IsString()
  liquidationPrice: string;

  @ApiProperty({ description: '杠杆倍数' })
  @IsNumber()
  leverage: number;

  @ApiProperty({ description: '维持保证金率' })
  @IsString()
  maintMarginRate: string;

  @ApiProperty({ description: '未实现盈亏' })
  @IsString()
  unrealizedPnl: string;

  @ApiProperty({ description: '已实现盈亏' })
  @IsString()
  realizedPnl: string;

  @ApiProperty({ description: '创建时间' })
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @Type(() => Date)
  updatedAt: Date;
}

export class UpdateLeverageDto {
  @ApiProperty({ description: '交易对', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '杠杆倍数', minimum: 1, maximum: 125 })
  @IsNumber()
  @Min(1)
  @Max(125)
  leverage: number;
}

export class FundingRateDto {
  @ApiProperty({ description: '交易对' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '资金费率' })
  @IsString()
  fundingRate: string;

  @ApiProperty({ description: '预测资金费率' })
  @IsString()
  nextFundingRate: string;

  @ApiProperty({ description: '下次收取时间' })
  @Type(() => Date)
  nextFundingTime: Date;
}

export class TradeHistoryDto {
  @ApiProperty({ description: '交易ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '用户ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '交易对' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderSide, description: '交易方向' })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ description: '价格' })
  @IsString()
  price: string;

  @ApiProperty({ description: '数量' })
  @IsString()
  quantity: string;

  @ApiProperty({ description: '手续费' })
  @IsString()
  commission: string;

  @ApiProperty({ description: '实现盈亏' })
  @IsString()
  realizedPnl: string;

  @ApiProperty({ description: '创建时间' })
  @Type(() => Date)
  createdAt: Date;
}
