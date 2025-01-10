import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TradeService } from '../trade/trade.service';
import { StatisticsQueryDto } from './dto/statistics.dto';
import { TradingMetricsResponse } from './dto/trading-metrics.dto';
import { BigNumber } from 'bignumber.js';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tradeService: TradeService,
  ) {}

  async getTradingMetrics(userId: string, query: StatisticsQueryDto): Promise<TradingMetricsResponse> {
    const trades = await this.tradeService.getUserTrades(userId, query.symbol);

    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: '0',
        averagePnl: '0',
        largestWin: '0',
        largestLoss: '0',
        averageWin: '0',
        averageLoss: '0',
        profitFactor: 0,
        maxDrawdown: '0',
        sharpeRatio: 0,
      };
    }

    let winningTrades = 0;
    let losingTrades = 0;
    let totalPnl = new BigNumber(0);
    let totalWins = new BigNumber(0);
    let totalLosses = new BigNumber(0);
    let largestWin = new BigNumber(0);
    let largestLoss = new BigNumber(0);
    let maxDrawdown = new BigNumber(0);
    let peakBalance = new BigNumber(0);
    let currentDrawdown = new BigNumber(0);

    for (const trade of trades) {
      const pnl = new BigNumber(trade.pnl);
      totalPnl = totalPnl.plus(pnl);

      if (pnl.isGreaterThan(0)) {
        winningTrades++;
        totalWins = totalWins.plus(pnl);
        if (pnl.isGreaterThan(largestWin)) {
          largestWin = pnl;
        }
      } else if (pnl.isLessThan(0)) {
        losingTrades++;
        totalLosses = totalLosses.plus(pnl.abs());
        if (pnl.abs().isGreaterThan(largestLoss)) {
          largestLoss = pnl.abs();
        }
      }

      // 计算最大回撤
      if (totalPnl.isGreaterThan(peakBalance)) {
        peakBalance = totalPnl;
        currentDrawdown = new BigNumber(0);
      } else {
        currentDrawdown = peakBalance.minus(totalPnl);
        if (currentDrawdown.isGreaterThan(maxDrawdown)) {
          maxDrawdown = currentDrawdown;
        }
      }
    }

    const winRate = (winningTrades / trades.length) * 100;
    const averageWin = winningTrades > 0 ? totalWins.dividedBy(winningTrades) : new BigNumber(0);
    const averageLoss = losingTrades > 0 ? totalLosses.dividedBy(losingTrades) : new BigNumber(0);
    const profitFactor = totalLosses.isGreaterThan(0) ? totalWins.dividedBy(totalLosses).toNumber() : 0;

    // 计算夏普比率
    const returns = trades.map(trade => new BigNumber(trade.pnl).dividedBy(trade.amount));
    const averageReturn = returns.reduce((a, b) => a.plus(b), new BigNumber(0)).dividedBy(returns.length);
    const stdDev = Math.sqrt(
      returns
        .map(r => r.minus(averageReturn).pow(2))
        .reduce((a, b) => a.plus(b), new BigNumber(0))
        .dividedBy(returns.length - 1)
        .toNumber(),
    );
    const sharpeRatio = stdDev !== 0 ? averageReturn.dividedBy(stdDev).toNumber() : 0;

    return {
      totalTrades: trades.length,
      winningTrades,
      losingTrades,
      winRate,
      totalPnl: totalPnl.toString(),
      averagePnl: totalPnl.dividedBy(trades.length).toString(),
      largestWin: largestWin.toString(),
      largestLoss: largestLoss.toString(),
      averageWin: averageWin.toString(),
      averageLoss: averageLoss.toString(),
      profitFactor,
      maxDrawdown: maxDrawdown.toString(),
      sharpeRatio,
    };
  }
} 