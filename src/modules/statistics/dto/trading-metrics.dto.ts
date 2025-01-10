export class TradingMetricsResponse {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: string;
  averagePnl: string;
  largestWin: string;
  largestLoss: string;
  averageWin: string;
  averageLoss: string;
  profitFactor: number;
  maxDrawdown: string;
  sharpeRatio: number;
} 