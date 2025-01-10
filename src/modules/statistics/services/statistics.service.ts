import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { TradeService } from '../../trade/trade.service';
import { StatisticsQueryDto, TimeFrame, TradingMetricsResponse, WinRateResponse } from '../dto/statistics.dto';
import { TradeHistoryDto, TradeResponseDto } from '../../trade/dto/trade.dto';

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

    // Convert dates to timestamps
    const startTime = query.startTime ? new Date(query.startTime).getTime() : undefined;
    const endTime = query.endTime ? new Date(query.endTime).getTime() : undefined;

    if (startTime && endTime && startTime > endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Get trades from database
    const tradesResult = await this.tradeService.getUserTrades(userId, {
      symbol: query.symbol,
      startTime,
      endTime,
    });

    const trades = tradesResult.trades;
    
    if (!trades.length) {
      return {
        totalTrades: 0,
        profitableTrades: 0,
        unprofitableTrades: 0,
        winRate: '0.00',
        totalPnL: '0.00000000',
        averageProfit: '0.00000000',
        averageLoss: '0.00000000',
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        profitFactor: '0.00',
        sharpeRatio: '0.00',
      };
    }

    // Calculate metrics
    const profitableTrades = trades.filter(t => this.isProfitableTrade(t));
    const unprofitableTrades = trades.filter(t => this.isUnprofitableTrade(t));

    const metrics: TradingMetricsResponse = {
      totalTrades: trades.length,
      profitableTrades: profitableTrades.length,
      unprofitableTrades: unprofitableTrades.length,
      winRate: this.calculateWinRate(profitableTrades.length, trades.length),
      totalPnL: this.calculateTotalPnL(trades),
      averageProfit: this.calculateAverageProfit(profitableTrades),
      averageLoss: this.calculateAverageLoss(unprofitableTrades),
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
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const cacheKey = `winrate:${userId}:${query.symbol}:${query.timeFrame}`;
    
    // Try to get from cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Convert dates to timestamps
    const startTime = query.startTime ? new Date(query.startTime).getTime() : undefined;
    const endTime = query.endTime ? new Date(query.endTime).getTime() : undefined;

    if (startTime && endTime && startTime > endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Get trades from database
    const tradesResult = await this.tradeService.getUserTrades(userId, {
      symbol: query.symbol,
      startTime,
      endTime,
    });

    const trades = tradesResult.trades;
    const profitableTrades = trades.filter(t => this.isProfitableTrade(t));

    const response: WinRateResponse = {
      symbol: query.symbol || 'ALL',
      winRate: this.calculateWinRate(profitableTrades.length, trades.length),
      totalTrades: trades.length,
      timeFrame: query.timeFrame || TimeFrame.MONTH,
    };

    // Cache the result
    await this.redis.set(cacheKey, JSON.stringify(response), 'EX', this.CACHE_TTL);

    return response;
  }

  private isProfitableTrade(trade: TradeResponseDto): boolean {
    return parseFloat(trade.pnl || '0') > 0;
  }

  private isUnprofitableTrade(trade: TradeResponseDto): boolean {
    return parseFloat(trade.pnl || '0') < 0;
  }

  private calculateWinRate(profitableCount: number, totalCount: number): string {
    if (totalCount === 0) return '0.00';
    return ((profitableCount / totalCount) * 100).toFixed(2);
  }

  private calculateTotalPnL(trades: TradeResponseDto[]): string {
    return trades
      .reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0)
      .toFixed(8);
  }

  private calculateAverageProfit(profitableTrades: TradeResponseDto[]): string {
    if (!profitableTrades.length) return '0.00000000';
    const totalProfit = profitableTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0);
    return (totalProfit / profitableTrades.length).toFixed(8);
  }

  private calculateAverageLoss(unprofitableTrades: TradeResponseDto[]): string {
    if (!unprofitableTrades.length) return '0.00000000';
    const totalLoss = unprofitableTrades.reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0);
    return (totalLoss / unprofitableTrades.length).toFixed(8);
  }

  private calculateMaxConsecutive(trades: TradeResponseDto[], profitable: boolean): number {
    let max = 0;
    let current = 0;
    
    for (const trade of trades) {
      const isProfitable = this.isProfitableTrade(trade);
      if (isProfitable === profitable) {
        current++;
        max = Math.max(max, current);
      } else {
        current = 0;
      }
    }
    
    return max;
  }

  private calculateProfitFactor(trades: TradeResponseDto[]): string {
    const grossProfit = trades
      .filter(t => this.isProfitableTrade(t))
      .reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0);
      
    const grossLoss = Math.abs(trades
      .filter(t => this.isUnprofitableTrade(t))
      .reduce((sum, t) => sum + parseFloat(t.pnl || '0'), 0));

    if (grossLoss === 0) return '∞';
    return (grossProfit / grossLoss).toFixed(2);
  }

  private calculateSharpeRatio(trades: TradeResponseDto[]): string {
    if (trades.length < 2) return '0.00';

    const returns = trades.map(t => parseFloat(t.pnl || '0'));
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const variance = returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return '0.00';
    return (avgReturn / stdDev).toFixed(2);
  }
}
