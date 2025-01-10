import { ApiProperty } from '@nestjs/swagger';

export class TradingMetricsResponse {
  @ApiProperty({ description: '总交易次数' })
  totalTrades: number;

  @ApiProperty({ description: '盈利交易次数' })
  winningTrades: number;

  @ApiProperty({ description: '亏损交易次数' })
  losingTrades: number;

  @ApiProperty({ description: '胜率', example: '65.5' })
  winRate: string;

  @ApiProperty({ description: '总盈亏', example: '1234.56' })
  totalPnl: string;

  @ApiProperty({ description: '平均盈亏', example: '123.45' })
  averagePnl: string;

  @ApiProperty({ description: '最大单笔盈利', example: '500.00' })
  largestWin: string;

  @ApiProperty({ description: '最大单笔亏损', example: '-300.00' })
  largestLoss: string;

  @ApiProperty({ description: '平均盈利', example: '123.45' })
  averageWin: string;

  @ApiProperty({ description: '平均亏损', example: '-45.67' })
  averageLoss: string;

  @ApiProperty({ description: '盈亏比', example: '2.5' })
  profitFactor: string;

  @ApiProperty({ description: '最大回撤', example: '10%' })
  maxDrawdown: string;

  @ApiProperty({ description: '夏普比率', example: '1.8' })
  sharpeRatio: string;
} 