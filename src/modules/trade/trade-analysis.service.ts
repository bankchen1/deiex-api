import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TradeAnalysisQueryDto,
  TradeStatistics,
  TradePerformance,
  DailyPerformance,
} from './dto/trade-analysis.dto';

@Injectable()
export class TradeAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async getTradeStatistics(
    userId: string,
    query: TradeAnalysisQueryDto,
  ): Promise<TradeStatistics> {
    const trades = await this.prisma.trade.findMany({
      where: {
        userId,
        symbol: query.symbol,
        createdAt: {
          gte: query.startDate,
          lte: query.endDate,
        },
      },
    });

    const winningTrades = trades.filter((t) => t.profit > 0);
    const losingTrades = trades.filter((t) => t.profit < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const totalLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.profit, 0),
    );

    const profitFactor = totalLoss === 0 ? totalProfit : totalProfit / totalLoss;
    const netProfit = totalProfit - totalLoss;

    // 计算最大回撤
    const { maxDrawdown, maxDrawdownPercentage } = this.calculateMaxDrawdown(trades);

    // 计算夏普比率
    const sharpeRatio = this.calculateSharpeRatio(trades);

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      profitFactor,
      averageWin:
        winningTrades.length > 0
          ? totalProfit / winningTrades.length
          : 0,
      averageLoss:
        losingTrades.length > 0
          ? totalLoss / losingTrades.length
          : 0,
      largestWin: Math.max(...trades.map((t) => t.profit)),
      largestLoss: Math.min(...trades.map((t) => t.profit)),
      totalProfit,
      totalLoss,
      netProfit,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPercentage,
    };
  }

  async getSymbolPerformance(
    userId: string,
    query: TradeAnalysisQueryDto,
  ): Promise<TradePerformance[]> {
    const trades = await this.prisma.trade.findMany({
      where: {
        userId,
        createdAt: {
          gte: query.startDate,
          lte: query.endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const symbolMap = new Map<string, TradePerformance>();

    trades.forEach((trade) => {
      const existing = symbolMap.get(trade.symbol) || {
        symbol: trade.symbol,
        profitLoss: 0,
        profitLossPercentage: 0,
        trades: 0,
        winRate: 0,
      };

      existing.profitLoss += trade.profit;
      existing.trades += 1;
      if (trade.profit > 0) {
        existing.winRate =
          ((existing.winRate * (existing.trades - 1) + 100) / existing.trades);
      }
      
      symbolMap.set(trade.symbol, existing);
    });

    return Array.from(symbolMap.values()).map((perf) => ({
      ...perf,
      profitLossPercentage:
        (perf.profitLoss / this.calculateInitialBalance(trades, perf.symbol)) * 100,
    }));
  }

  async getDailyPerformance(
    userId: string,
    query: TradeAnalysisQueryDto,
  ): Promise<DailyPerformance[]> {
    const trades = await this.prisma.trade.findMany({
      where: {
        userId,
        symbol: query.symbol,
        createdAt: {
          gte: query.startDate,
          lte: query.endDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const dailyMap = new Map<string, DailyPerformance>();
    let runningBalance = 0;
    let maxBalance = 0;

    trades.forEach((trade) => {
      const date = trade.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(date) || {
        date: new Date(date),
        profitLoss: 0,
        trades: 0,
        winRate: 0,
        drawdown: 0,
      };

      existing.profitLoss += trade.profit;
      existing.trades += 1;
      if (trade.profit > 0) {
        existing.winRate =
          ((existing.winRate * (existing.trades - 1) + 100) / existing.trades);
      }

      runningBalance += trade.profit;
      maxBalance = Math.max(maxBalance, runningBalance);
      existing.drawdown = maxBalance - runningBalance;

      dailyMap.set(date, existing);
    });

    return Array.from(dailyMap.values());
  }

  private calculateMaxDrawdown(trades: any[]): {
    maxDrawdown: number;
    maxDrawdownPercentage: number;
  } {
    let maxBalance = 0;
    let currentBalance = 0;
    let maxDrawdown = 0;
    let maxDrawdownPercentage = 0;

    trades.forEach((trade) => {
      currentBalance += trade.profit;
      maxBalance = Math.max(maxBalance, currentBalance);

      const drawdown = maxBalance - currentBalance;
      maxDrawdown = Math.max(maxDrawdown, drawdown);

      if (maxBalance > 0) {
        const drawdownPercentage = (drawdown / maxBalance) * 100;
        maxDrawdownPercentage = Math.max(maxDrawdownPercentage, drawdownPercentage);
      }
    });

    return { maxDrawdown, maxDrawdownPercentage };
  }

  private calculateSharpeRatio(trades: any[]): number {
    if (trades.length < 2) return 0;

    const returns = trades.map((t) => t.profit);
    const averageReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const riskFreeRate = 0.02 / 365; // 假设无风险利率为2%

    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - averageReturn, 2), 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    return stdDev === 0 ? 0 : (averageReturn - riskFreeRate) / stdDev;
  }

  private calculateInitialBalance(trades: any[], symbol: string): number {
    return trades
      .filter((t) => t.symbol === symbol)
      .reduce((sum, t) => sum + t.margin, 0);
  }
}
