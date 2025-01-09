export enum CopyTraderStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  INACTIVE = 'INACTIVE',
}

export enum CopyTradeStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
}

export interface CopyTrader {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: CopyTraderStatus;
  profitRate: number;
  winRate: number;
  totalTrades: number;
  followers: number;
  aum: number; // Assets Under Management
  maxFollowers: number;
  minCopyAmount: number;
  maxCopyAmount: number;
  commission: number; // 分成比例
  createdAt: Date;
  updatedAt: Date;
}

export interface CopyTrade {
  id: string;
  followerId: string;
  traderId: string;
  status: CopyTradeStatus;
  copyAmount: number;
  profitRate: number;
  pnl: number;
  maxDrawdown: number;
  copyRatio: number;
  maxRiskPerTrade: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TraderStats {
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalPnL: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  averageTradeSize: number;
  averageDuration: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  profitableLongs: number;
  profitableShorts: number;
}

export interface CopyTradeEvent {
  type: 'OPEN' | 'CLOSE' | 'MODIFY';
  traderId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  price: number;
  amount: number;
  leverage: number;
  timestamp: number;
}

export interface RiskMetrics {
  drawdown: number;
  exposureRatio: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
}
