import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType, OrderSide, PositionSide } from '../types/perpetual.types';

export class CreateOrderDto {
  @ApiProperty({ description: '交易对', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ enum: OrderType, description: '订单类型' })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ enum: OrderSide, description: '订单方向' })
  @IsEnum(OrderSide)
  side: OrderSide;

  @ApiProperty({ description: '下单数量', example: 1.5 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: '下单价格(市价单可不传)', required: false })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({ description: '触发价格(限价单可不传)', required: false })
  @IsNumber()
  @IsOptional()
  triggerPrice?: number;
}

export class AdjustLeverageDto {
  @ApiProperty({ description: '交易对', example: 'BTC-USDT' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '杠杆倍数', minimum: 1, maximum: 125 })
  @IsNumber()
  @Min(1)
  @Max(125)
  leverage: number;
}

export class OrderQueryDto {
  @ApiProperty({ description: '交易对', required: false })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiProperty({ enum: OrderType, description: '订单类型', required: false })
  @IsEnum(OrderType)
  @IsOptional()
  type?: OrderType;

  @ApiProperty({ enum: OrderSide, description: '订单方向', required: false })
  @IsEnum(OrderSide)
  @IsOptional()
  side?: OrderSide;

  @ApiProperty({ description: '页码', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class PositionQueryDto {
  @ApiProperty({ description: '交易对', required: false })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiProperty({ enum: PositionSide, description: '持仓方向', required: false })
  @IsEnum(PositionSide)
  @IsOptional()
  side?: PositionSide;
}
