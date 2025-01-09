import { Kline } from '../types/kline.type';
import { OrderSide, OrderType } from '../types/order.type';

export abstract class BaseStrategy {
  protected abstract name: string;
  protected abstract description: string;
  protected abstract parameters: Record<string, any>;

  // 计算SMA
  protected calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  // 计算EMA
  protected calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // 第一个EMA值使用SMA
    let prevEma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(prevEma);

    for (let i = period; i < prices.length; i++) {
      const currentEma = (prices[i] - prevEma) * multiplier + prevEma;
      ema.push(currentEma);
      prevEma = currentEma;
    }

    return ema;
  }

  // 计算MACD
  protected calculateMACD(prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    // 计算MACD线
    const macd: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      macd.push(fastEMA[i] - slowEMA[i]);
    }

    // 计算信号线
    const signal = this.calculateEMA(macd, signalPeriod);

    // 计算柱状图
    const histogram = macd.map((value, i) => value - signal[i]);

    return { macd, signal, histogram };
  }

  // 计算RSI
  protected calculateRSI(prices: number[], period = 14): number[] {
    const rsi: number[] = [];
    const gains: number[] = [0];
    const losses: number[] = [0];

    // 计算价格变化
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    // 计算初始平均增益和损失
    let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

    // 第一个RSI值
    rsi.push(100 - (100 / (1 + avgGain / avgLoss)));

    // 计算后续RSI值
    for (let i = period + 1; i < prices.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
      rsi.push(100 - (100 / (1 + avgGain / avgLoss)));
    }

    return rsi;
  }

  // 计算布林带
  protected calculateBollingerBands(prices: number[], period = 20, stdDev = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const avg = middle[i - period + 1];
      const std = Math.sqrt(
        slice.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / period
      );
      upper.push(avg + stdDev * std);
      lower.push(avg - stdDev * std);
    }

    return { upper, middle, lower };
  }

  // 计算止损价格
  protected calculateStopLoss(entryPrice: number, side: OrderSide, percentage: number): number {
    return side === OrderSide.BUY
      ? entryPrice * (1 - percentage)
      : entryPrice * (1 + percentage);
  }

  // 计算止盈价格
  protected calculateTakeProfit(entryPrice: number, side: OrderSide, percentage: number): number {
    return side === OrderSide.BUY
      ? entryPrice * (1 + percentage)
      : entryPrice * (1 - percentage);
  }

  // 计算移动止损价格
  protected calculateTrailingStop(currentPrice: number, side: OrderSide, percentage: number): number {
    return side === OrderSide.BUY
      ? currentPrice * (1 - percentage)
      : currentPrice * (1 + percentage);
  }

  // 生成交易信号
  abstract generateSignals(klines: Kline[]): {
    side: OrderSide | null;
    type: OrderType;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
  }[];

  // 计算仓位大小
  abstract calculatePositionSize(
    balance: number,
    price: number,
    risk: number
  ): number;

  // 确定退出条件
  abstract determineExitConditions(
    position: {
      side: OrderSide;
      entryPrice: number;
      size: number;
      stopLoss?: number;
      takeProfit?: number;
    },
    currentPrice: number
  ): boolean;
} 