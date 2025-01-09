import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BacktestDto } from '../dto/strategy.dto';

interface Trade {
  timestamp: Date;
  type: 'ENTRY' | 'EXIT';
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  profit?: number;
}

interface BacktestResult {
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  trades: Trade[];
  metrics: {
    sharpeRatio: number;
    profitFactor: number;
    averageProfit: number;
    averageLoss: number;
    largestProfit: number;
    largestLoss: number;
    profitableTradesCount: number;
    unprofitableTradesCount: number;
    consecutiveWins: number;
    consecutiveLosses: number;
  };
  equity: Array<{
    timestamp: Date;
    value: number;
  }>;
}

@Injectable()
export class BacktestService {
  constructor(private readonly prisma: PrismaService) {}

  async runBacktest(strategyId: string, dto: BacktestDto): Promise<BacktestResult> {
    // 1. 获取历史K线数据
    const klines = await this.prisma.kline.findMany({
      where: {
        symbol: dto.symbol,
        timestamp: {
          gte: dto.startTime,
          lte: dto.endTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    if (klines.length === 0) {
      throw new Error('回测期间无可用数据');
    }

    // 2. 初始化回测环境
    const trades: Trade[] = [];
    let equity = dto.initialCapital;
    const equityHistory: Array<{ timestamp: Date; value: number }> = [
      { timestamp: dto.startTime, value: equity },
    ];
    let maxEquity = equity;
    let maxDrawdown = 0;
    let position = null;

    // 3. 执行回测
    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];
      const signal = await this.generateSignal(kline, klines.slice(0, i + 1), dto.parameters);

      if (signal && !position) {
        // 开仓
        position = {
          entryPrice: Number(kline.close),
          amount: this.calculatePositionSize(equity, Number(kline.close), dto.parameters),
          side: signal.side,
        };

        trades.push({
          timestamp: kline.timestamp,
          type: 'ENTRY',
          side: signal.side,
          price: Number(kline.close),
          amount: position.amount,
        });
      } else if (position && this.shouldExit(kline, position, dto.parameters)) {
        // 平仓
        const profit = this.calculateProfit(position, Number(kline.close));
        equity += profit;

        trades.push({
          timestamp: kline.timestamp,
          type: 'EXIT',
          side: position.side === 'BUY' ? 'SELL' : 'BUY',
          price: Number(kline.close),
          amount: position.amount,
          profit,
        });

        // 更新最大回撤
        if (equity > maxEquity) {
          maxEquity = equity;
        } else {
          const drawdown = (maxEquity - equity) / maxEquity;
          if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
          }
        }

        equityHistory.push({ timestamp: kline.timestamp, value: equity });
        position = null;
      }
    }

    // 4. 计算回测指标
    const metrics = this.calculateMetrics(trades, dto.initialCapital);

    // 5. 保存回测结果
    await this.prisma.strategyBacktest.create({
      data: {
        strategyId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        parameters: dto.parameters || {},
        result: {
          totalReturn: metrics.totalReturn,
          maxDrawdown,
          winRate: metrics.winRate,
          trades: trades,
          metrics: metrics,
          equity: equityHistory,
        },
      },
    });

    return {
      totalReturn: metrics.totalReturn,
      maxDrawdown,
      winRate: metrics.winRate,
      trades,
      metrics,
      equity: equityHistory,
    };
  }

  private async generateSignal(
    currentKline: any,
    historicalKlines: any[],
    parameters: any,
  ): Promise<{ side: 'BUY' | 'SELL' } | null> {
    // TODO: 根据策略参数生成交易信号
    // 这里需要实现具体的策略逻辑
    return null;
  }

  private shouldExit(currentKline: any, position: any, parameters: any): boolean {
    // TODO: 实现平仓逻辑
    // 这里需要根据策略参数判断是否应该平仓
    return false;
  }

  private calculatePositionSize(equity: number, price: number, parameters: any): number {
    // TODO: 实现仓位计算逻辑
    // 这里需要根据策略参数计算开仓数量
    return 0;
  }

  private calculateProfit(position: any, exitPrice: number): number {
    const { entryPrice, amount, side } = position;
    return side === 'BUY'
      ? (exitPrice - entryPrice) * amount
      : (entryPrice - exitPrice) * amount;
  }

  private calculateMetrics(trades: Trade[], initialCapital: number): any {
    const profitableTrades = trades.filter((t) => t.profit && t.profit > 0);
    const unprofitableTrades = trades.filter((t) => t.profit && t.profit <= 0);

    const totalProfit = profitableTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const totalLoss = unprofitableTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

    const profitableTradesCount = profitableTrades.length;
    const unprofitableTradesCount = unprofitableTrades.length;
    const totalTrades = trades.length;

    const winRate = (profitableTradesCount / totalTrades) * 100;
    const profitFactor = Math.abs(totalProfit / totalLoss);
    const totalReturn = ((totalProfit + totalLoss) / initialCapital) * 100;

    return {
      totalReturn,
      winRate,
      profitFactor,
      averageProfit: profitableTradesCount > 0 ? totalProfit / profitableTradesCount : 0,
      averageLoss: unprofitableTradesCount > 0 ? totalLoss / unprofitableTradesCount : 0,
      largestProfit: Math.max(...profitableTrades.map((t) => t.profit || 0), 0),
      largestLoss: Math.min(...unprofitableTrades.map((t) => t.profit || 0), 0),
      profitableTradesCount,
      unprofitableTradesCount,
      consecutiveWins: this.calculateConsecutive(trades, true),
      consecutiveLosses: this.calculateConsecutive(trades, false),
      sharpeRatio: this.calculateSharpeRatio(trades),
    };
  }

  private calculateConsecutive(trades: Trade[], isWin: boolean): number {
    let maxConsecutive = 0;
    let current = 0;

    for (const trade of trades) {
      if (!trade.profit) continue;

      if ((isWin && trade.profit > 0) || (!isWin && trade.profit <= 0)) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }

    return maxConsecutive;
  }

  private calculateSharpeRatio(trades: Trade[]): number {
    const returns = trades
      .filter((t) => t.profit)
      .map((t) => (t.profit || 0));

    if (returns.length === 0) return 0;

    const averageReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - averageReturn, 2), 0) / returns.length;
    const standardDeviation = Math.sqrt(variance);

    return standardDeviation === 0 ? 0 : averageReturn / standardDeviation;
  }
} 