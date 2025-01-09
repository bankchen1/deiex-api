import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum TimeFrame {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class StatisticsQueryDto {
  @ApiProperty({ description: '交易对', required: false })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiProperty({ description: '开始时间', required: false })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiProperty({ description: '结束时间', required: false })
  @IsDateString()
  @IsOptional()
  endTime?: string;

  @ApiProperty({ enum: TimeFrame, description: '时间周期', required: false, default: TimeFrame.MONTH })
  @IsEnum(TimeFrame)
  @IsOptional()
  timeFrame?: TimeFrame = TimeFrame.MONTH;
}

export class TradingMetricsResponse {
  @ApiProperty({ description: '总交易次数' })
  totalTrades: number;

  @ApiProperty({ description: '盈利交易次数' })
  profitableTrades: number;

  @ApiProperty({ description: '亏损交易次数' })
  unprofitableTrades: number;

  @ApiProperty({ description: '胜率', example: '65.5' })
  winRate: string;

  @ApiProperty({ description: '总盈亏', example: '1234.56' })
  totalPnL: string;

  @ApiProperty({ description: '平均盈利', example: '123.45' })
  averageProfit: string;

  @ApiProperty({ description: '平均亏损', example: '-45.67' })
  averageLoss: string;

  @ApiProperty({ description: '最大连续盈利次数' })
  maxConsecutiveWins: number;

  @ApiProperty({ description: '最大连续亏损次数' })
  maxConsecutiveLosses: number;

  @ApiProperty({ description: '盈亏比', example: '2.5' })
  profitFactor: string;

  @ApiProperty({ description: '夏普比率', example: '1.8' })
  sharpeRatio: string;
}

export class WinRateResponse {
  @ApiProperty({ description: '交易对' })
  symbol: string;

  @ApiProperty({ description: '胜率', example: '65.5' })
  winRate: string;

  @ApiProperty({ description: '交易次数' })
  totalTrades: number;

  @ApiProperty({ description: '时间周期' })
  timeFrame: string;
}
