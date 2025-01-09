import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TradeAnalysisQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  symbol?: string;
}

export interface TradeStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
}

export interface TradePerformance {
  symbol: string;
  profitLoss: number;
  profitLossPercentage: number;
  trades: number;
  winRate: number;
}

export interface DailyPerformance {
  date: Date;
  profitLoss: number;
  trades: number;
  winRate: number;
  drawdown: number;
}
