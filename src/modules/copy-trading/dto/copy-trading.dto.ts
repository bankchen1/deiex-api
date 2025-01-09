import { ApiProperty } from '@nestjs/swagger';

export enum CopyTradingStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  INACTIVE = 'INACTIVE',
}

export class FollowTraderDto {
  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '复制比例（百分比）', minimum: 1, maximum: 100 })
  copyPercentage: number;

  @ApiProperty({ description: '最大持仓数量', required: false })
  maxPositions?: number;

  @ApiProperty({ description: '最大亏损百分比', required: false })
  maxLossPercentage?: number;
}

export class CopyTradeSettingsDto {
  @ApiProperty({ description: '复制比例（百分比）', minimum: 1, maximum: 100 })
  copyPercentage: number;

  @ApiProperty({ description: '最大持仓数量', required: false })
  maxPositions?: number;

  @ApiProperty({ description: '最大亏损百分比', required: false })
  maxLossPercentage?: number;
}

export class CopyTradingStatsDto {
  @ApiProperty({ description: '总收益' })
  totalProfit: number;

  @ApiProperty({ description: '胜率（百分比）' })
  winRate: number;

  @ApiProperty({ description: '总交易次数' })
  totalTrades: number;

  @ApiProperty({ description: '成功交易次数' })
  successfulTrades: number;

  @ApiProperty({ description: '平均收益' })
  averageProfit: number;

  @ApiProperty({ description: '跟随者数量' })
  followersCount: number;
}

export class CopyTradingHistoryDto {
  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '交易对' })
  symbol: string;

  @ApiProperty({ description: '交易数量' })
  amount: number;

  @ApiProperty({ description: '收益' })
  profit: number;

  @ApiProperty({ description: '复制时间' })
  copyTime: Date;

  @ApiProperty({ description: '状态' })
  status: string;
}

export class TraderRankingDto {
  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '总收益' })
  totalProfit: number;

  @ApiProperty({ description: '胜率' })
  winRate: number;

  @ApiProperty({ description: '跟随者数量' })
  followersCount: number;

  @ApiProperty({ description: '排名' })
  ranking: number;
}

export class CopyTradingDto {
  @ApiProperty({ description: '跟随者ID' })
  followerId: string;

  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '跟单比例' })
  copyRatio: number;

  @ApiProperty({ description: '最大跟单金额' })
  maxCopyAmount: number;

  @ApiProperty({ description: '最小跟单金额' })
  minCopyAmount: number;

  @ApiProperty({ description: '是否启用' })
  isActive: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class CreateCopyTradingDto {
  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '跟单比例', minimum: 0.01, maximum: 1 })
  copyRatio: number;

  @ApiProperty({ description: '最大跟单金额', minimum: 0 })
  maxCopyAmount: number;

  @ApiProperty({ description: '最小跟单金额', minimum: 0 })
  minCopyAmount: number;
}

export class UpdateCopyTradingDto {
  @ApiProperty({ description: '跟单比例', minimum: 0.01, maximum: 1, required: false })
  copyRatio?: number;

  @ApiProperty({ description: '最大跟单金额', minimum: 0, required: false })
  maxCopyAmount?: number;

  @ApiProperty({ description: '最小跟单金额', minimum: 0, required: false })
  minCopyAmount?: number;
}

export class CopyTradingHistoryDto {
  @ApiProperty({ description: '跟单记录ID' })
  id: string;

  @ApiProperty({ description: '跟随者ID' })
  followerId: string;

  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '交易对' })
  symbol: string;

  @ApiProperty({ description: '交易方向' })
  side: string;

  @ApiProperty({ description: '交易数量' })
  quantity: string;

  @ApiProperty({ description: '交易价格' })
  price: string;

  @ApiProperty({ description: '实现盈亏' })
  realizedPnl: string;

  @ApiProperty({ description: '手续费' })
  commission: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

export class TraderRankingDto {
  @ApiProperty({ description: '交易者ID' })
  traderId: string;

  @ApiProperty({ description: '排名' })
  rank: number;

  @ApiProperty({ description: '排名类别', enum: ['Followers', 'PnL', 'WinRate', 'Sharpe', 'Overall'] })
  category: 'Followers' | 'PnL' | 'WinRate' | 'Sharpe' | 'Overall';

  @ApiProperty({ description: '得分' })
  score: number;

  @ApiProperty({ description: '上次排名' })
  previousRank: number;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}