import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum StrategyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TESTING = 'testing',
  ARCHIVED = 'archived',
}

export class CreateStrategyDto {
  @ApiProperty({ description: '策略名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '策略描述' })
  @IsString()
  description: string;

  @ApiProperty({ description: '交易对', required: false })
  @IsString()
  @IsOptional()
  symbol?: string;

  @ApiProperty({ description: '策略参数', required: false })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class UpdateStrategyDto {
  @ApiProperty({ description: '策略名称', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: '策略描述', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: '策略状态', enum: StrategyStatus, required: false })
  @IsEnum(StrategyStatus)
  @IsOptional()
  status?: StrategyStatus;

  @ApiProperty({ description: '策略参数', required: false })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class StrategyPerformanceDto {
  @ApiProperty({ description: '总收益率' })
  @IsNumber()
  @Type(() => Number)
  totalReturn: number;

  @ApiProperty({ description: '月收益率' })
  @IsNumber()
  @Type(() => Number)
  monthlyReturn: number;

  @ApiProperty({ description: '最大回撤' })
  @IsNumber()
  @Type(() => Number)
  maxDrawdown: number;

  @ApiProperty({ description: '胜率' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  winRate: number;

  @ApiProperty({ description: '跟随者数量' })
  @IsNumber()
  @Type(() => Number)
  followers: number;

  @ApiProperty({ description: '运行天数' })
  @IsNumber()
  @Type(() => Number)
  runningDays: number;
}

export class BacktestDto {
  @ApiProperty({ description: '开始时间' })
  @Type(() => Date)
  startTime: Date;

  @ApiProperty({ description: '结束时间' })
  @Type(() => Date)
  endTime: Date;

  @ApiProperty({ description: '初始资金' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  initialCapital: number;

  @ApiProperty({ description: '交易对' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '策略参数', required: false })
  @IsOptional()
  parameters?: Record<string, any>;
}

export class StrategySubscriptionDto {
  @ApiProperty({ description: '策略ID' })
  @IsString()
  strategyId: string;

  @ApiProperty({ description: '复制比例', minimum: 0.1, maximum: 1 })
  @IsNumber()
  @Min(0.1)
  @Max(1)
  @Type(() => Number)
  copyRatio: number;

  @ApiProperty({ description: '最大亏损限制', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  maxLossPercentage?: number;
} 