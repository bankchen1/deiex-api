import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum CopyTradingStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  INACTIVE = 'INACTIVE',
}

export class FollowTraderDto {
  @ApiProperty({ description: '交易者ID' })
  @IsString()
  traderId: string;

  @ApiProperty({ description: '复制比例（百分比）', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  copyPercentage: number;

  @ApiProperty({ description: '最大持仓数量', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  maxPositions?: number;

  @ApiProperty({ description: '最大亏损百分比', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  maxLossPercentage?: number;
}

export class CopyTradeSettingsDto {
  @ApiProperty({ description: '复制比例（百分比）', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  copyPercentage: number;

  @ApiProperty({ description: '最大持仓数量', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  maxPositions?: number;

  @ApiProperty({ description: '最大亏损百分比', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  maxLossPercentage?: number;
}

export class CopyTradingStatsDto {
  @ApiProperty({ description: '总收益' })
  @IsNumber()
  @Type(() => Number)
  totalProfit: number;

  @ApiProperty({ description: '胜率（百分比）' })
  @IsNumber()
  @Type(() => Number)
  winRate: number;

  @ApiProperty({ description: '总交易次数' })
  @IsNumber()
  @Type(() => Number)
  totalTrades: number;

  @ApiProperty({ description: '成功交易次数' })
  @IsNumber()
  @Type(() => Number)
  successfulTrades: number;

  @ApiProperty({ description: '平均收益' })
  @IsNumber()
  @Type(() => Number)
  averageProfit: number;

  @ApiProperty({ description: '跟随者数量' })
  @IsNumber()
  @Type(() => Number)
  followersCount: number;
}

export class CopyTradingHistoryDto {
  @ApiProperty({ description: '交易者ID' })
  @IsString()
  traderId: string;

  @ApiProperty({ description: '交易对' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '交易数量' })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: '收益' })
  @IsNumber()
  @Type(() => Number)
  profit: number;

  @ApiProperty({ description: '复制时间' })
  @Type(() => Date)
  copyTime: Date;

  @ApiProperty({ description: '状态' })
  @IsString()
  status: string;
}

export class TraderRankingDto {
  @ApiProperty({ description: '交易者ID' })
  @IsString()
  traderId: string;

  @ApiProperty({ description: '用户名' })
  @IsString()
  username: string;

  @ApiProperty({ description: '总收益' })
  @IsNumber()
  @Type(() => Number)
  totalProfit: number;

  @ApiProperty({ description: '胜率' })
  @IsNumber()
  @Type(() => Number)
  winRate: number;

  @ApiProperty({ description: '跟随者数量' })
  @IsNumber()
  @Type(() => Number)
  followersCount: number;

  @ApiProperty({ description: '排名' })
  @IsNumber()
  @Type(() => Number)
  ranking: number;
} 