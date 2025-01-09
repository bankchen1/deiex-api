import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TradeService } from '../../trade/trade.service';
import { StatisticsQueryDto, TimeFrame, TradingMetricsResponse, WinRateResponse } from '../dto/statistics.dto';

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
    const cacheKey = `metrics:${userId}:${query.symbol}:${query.timeFrame}`;
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get trades from database
    const trades = await this.tradeService.getUserTrades(userId, {
      symbol: query.symbol,
      startTime: query.startTime,
      endTime: query.endTime,
    });

    // Calculate metrics
    const profitableTrades = trades.filter(t => parseFloat(t.realizedPnL) > 0);
    const unprofitableTrades = trades.filter(t => parseFloat(t.realizedPnL) < 0);

    const metrics: TradingMetricsResponse = {
      totalTrades: trades.length,
      profitableTrades: profitableTrades.length,
      unprofitableTrades: unprofitableTrades.length,
      winRate: ((profitableTrades.length / trades.length) * 100).toFixed(2),
      totalPnL: trades.reduce((sum, t) => sum + parseFloat(t.realizedPnL), 0).toFixed(8),
      averageProfit: profitableTrades.length ? 
        (profitableTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnL), 0) / profitableTrades.length).toFixed(8) : '0',
      averageLoss: unprofitableTrades.length ? 
        (unprofitableTrades.reduce((sum, t) => sum + parseFloat(t.realizedPnL), 0) / unprofitableTrades.length).toFixed(8) : '0',
      maxConsecutiveWins: this.calculateMaxConsecutive(trades, true),
      maxConsecutiveLosses: this.calculateMaxConsecutive(trades, false),
      profitFactor: this.calculateProfitFactor(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
    };

    // Cache the result
    await this.redis.set(cacheKey, JSON.stringify(metrics), 'EX', this.CACHE_TTL);

    return metrics;
  }

  async getWinRate(
    userId: string,
    query: StatisticsQueryDto,
  ): Promise<WinRateResponse> {
    const cacheKey = `winrate:${userId}:${query.symbol}:${query.timeFrame}`;
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get trades from database
    const trades = await this.tradeService.getUserTrades(userId, {
      symbol: query.symbol,
      startTime: query.startTime,
      endTime: query.endTime,
    });

    const profitableTrades = trades.filter(t => parseFloat(t.realizedPnL) > 0);

    const response: WinRateResponse = {
      symbol: query.symbol || 'ALL',
      winRate: ((profitableTrades.length / trades.length) * 100).toFixed(2),
      totalTrades: trades.length,
      timeFrame: query.timeFrame || TimeFrame.MONTH,
    };

    // Cache the result
    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', this.CACHE_TTL);

    return response;
  }

  private calculateMaxConsecutive(trades: any[], profitable: boolean): number {
    let max = 0;
    let current = 0;
    
    for (const trade of trades) {
      const isProfitable = parseFloat(trade.realizedPnL) > 0;
      if (isProfitable === profitable) {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }
    
    return max;
  }

  private calculateProfitFactor(trades: any[]): string {
    const grossProfit = trades
      .filter(t => parseFloat(t.realizedPnL) > 0)
      .reduce((sum, t) => sum + parseFloat(t.realizedPnL), 0);
      
    const grossLoss = Math.abs(trades
      .filter(t => parseFloat(t.realizedPnL) < 0)
      .reduce((sum, t) => sum + parseFloat(t.realizedPnL), 0));

    return grossLoss === 0 ? '∞' : (grossProfit / grossLoss).toFixed(2);
  }

  private calculateSharpeRatio(trades: any[]): string {
    if (trades.length < 2) return '0';

    const returns = trades.map(t => parseFloat(t.realizedPnL));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / (returns.length - 1)
    );

    return stdDev === 0 ? '0' : (avgReturn / stdDev).toFixed(2);
  }
}
