import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TradeService } from '../../trade/trade.service';
import { StatisticsQueryDto } from '../dto/statistics.dto';
import { TradingMetricsResponse } from '../dto/trading-metrics.dto';
import { TradeResponseDto } from '../../trade/dto/trade.dto';
import { BigNumber } from 'bignumber.js';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly tradeService: TradeService,
  ) {}

  async getTradingMetrics(
    userId: string,
    query: StatisticsQueryDto,
  ): Promise<TradingMetricsResponse> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const cacheKey = `metrics:${userId}:${query.symbol}:${query.timeFrame}`;
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let filteredTrades = await this.tradeService.getUserTrades(userId, query.symbol);
    if (query.startTime) {
      const startDate = new Date(query.startTime);
      filteredTrades = filteredTrades.filter(trade => trade.createdAt >= startDate);
    }
    if (query.endTime) {
      const endDate = new Date(query.endTime);
      filteredTrades = filteredTrades.filter(trade => trade.createdAt <= endDate);
    }

    if (filteredTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: '0.00',
        totalPnl: '0.00',
        averagePnl: '0.00',
        largestWin: '0.00',
        largestLoss: '0.00',
        averageWin: '0.00',
        averageLoss: '0.00',
        profitFactor: '0.00',
        maxDrawdown: '0.00',
        sharpeRatio: '0.00',
      };
    }

    // Calculate metrics
    const winningTrades = filteredTrades.filter(t => this.isProfitableTrade(t));
    const losingTrades = filteredTrades.filter(t => this.isUnprofitableTrade(t));

    const totalPnl = this.calculateTotalPnL(filteredTrades);
    const averagePnl = new BigNumber(totalPnl).dividedBy(filteredTrades.length).toFixed(2);
    const largestWin = this.calculateLargestWin(winningTrades);
    const largestLoss = this.calculateLargestLoss(losingTrades);
    const averageWin = this.calculateAverageProfit(winningTrades);
    const averageLoss = this.calculateAverageLoss(losingTrades);
    const profitFactor = this.calculateProfitFactor(filteredTrades);
    const maxDrawdown = this.calculateMaxDrawdown(filteredTrades);
    const sharpeRatio = this.calculateSharpeRatio(filteredTrades);

    const metrics: TradingMetricsResponse = {
      totalTrades: filteredTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.calculateWinRate(winningTrades.length, filteredTrades.length),
      totalPnl,
      averagePnl,
      largestWin,
      largestLoss,
      averageWin,
      averageLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
    };

    // Cache the result
    await this.redis.set(cacheKey, JSON.stringify(metrics), 'EX', this.CACHE_TTL);

    return metrics;
  }

  private isProfitableTrade(trade: TradeResponseDto): boolean {
    return new BigNumber(trade.pnl || '0').isGreaterThan(0);
  }

  private isUnprofitableTrade(trade: TradeResponseDto): boolean {
    return new BigNumber(trade.pnl || '0').isLessThan(0);
  }

  private calculateWinRate(winningCount: number, totalCount: number): string {
    if (totalCount === 0) return '0.00';
    return ((winningCount / totalCount) * 100).toFixed(2);
  }

  private calculateTotalPnL(trades: TradeResponseDto[]): string {
    return trades
      .reduce((sum, t) => sum.plus(t.pnl || '0'), new BigNumber(0))
      .toFixed(2);
  }

  private calculateLargestWin(winningTrades: TradeResponseDto[]): string {
    if (!winningTrades.length) return '0.00';
    return winningTrades
      .reduce((max, t) => BigNumber.max(max, new BigNumber(t.pnl || '0')), new BigNumber(0))
      .toFixed(2);
  }

  private calculateLargestLoss(losingTrades: TradeResponseDto[]): string {
    if (!losingTrades.length) return '0.00';
    return losingTrades
      .reduce((min, t) => BigNumber.min(min, new BigNumber(t.pnl || '0')), new BigNumber(0))
      .toFixed(2);
  }

  private calculateAverageProfit(winningTrades: TradeResponseDto[]): string {
    if (!winningTrades.length) return '0.00';
    const totalProfit = winningTrades.reduce((sum, t) => sum.plus(t.pnl || '0'), new BigNumber(0));
    return totalProfit.dividedBy(winningTrades.length).toFixed(2);
  }

  private calculateAverageLoss(losingTrades: TradeResponseDto[]): string {
    if (!losingTrades.length) return '0.00';
    const totalLoss = losingTrades.reduce((sum, t) => sum.plus(t.pnl || '0'), new BigNumber(0));
    return totalLoss.dividedBy(losingTrades.length).toFixed(2);
  }

  private calculateMaxDrawdown(trades: TradeResponseDto[]): string {
    if (trades.length === 0) return '0.00';

    let peak = new BigNumber(0);
    let maxDrawdown = new BigNumber(0);
    let currentDrawdown = new BigNumber(0);

    trades.forEach(trade => {
      const pnl = new BigNumber(trade.pnl || '0');
      currentDrawdown = currentDrawdown.plus(pnl);

      if (currentDrawdown.isGreaterThan(peak)) {
        peak = currentDrawdown;
      }

      const drawdown = peak.minus(currentDrawdown);
      if (drawdown.isGreaterThan(maxDrawdown)) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown.toFixed(2);
  }

  private calculateProfitFactor(trades: TradeResponseDto[]): string {
    const grossProfit = trades
      .filter(t => this.isProfitableTrade(t))
      .reduce((sum, t) => sum.plus(t.pnl || '0'), new BigNumber(0));
      
    const grossLoss = trades
      .filter(t => this.isUnprofitableTrade(t))
      .reduce((sum, t) => sum.plus(t.pnl || '0'), new BigNumber(0))
      .abs();

    if (grossLoss.isEqualTo(0)) return '∞';
    return grossProfit.dividedBy(grossLoss).toFixed(2);
  }

  private calculateSharpeRatio(trades: TradeResponseDto[]): string {
    if (trades.length < 2) return '0.00';

    const returns = trades.map(t => new BigNumber(t.pnl || '0'));
    const avgReturn = returns.reduce((a, b) => a.plus(b), new BigNumber(0)).dividedBy(returns.length);
    
    const variance = returns
      .reduce((sq, n) => sq.plus(n.minus(avgReturn).pow(2)), new BigNumber(0))
      .dividedBy(returns.length - 1);
    const stdDev = variance.sqrt();

    if (stdDev.isEqualTo(0)) return '0.00';
    return avgReturn.dividedBy(stdDev).toFixed(2);
  }
}
