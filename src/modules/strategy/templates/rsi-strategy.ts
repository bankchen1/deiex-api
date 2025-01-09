import { BaseStrategy, StrategyParameters, StrategySignal, StrategyPosition } from './base-strategy';
import { Kline } from '../types/kline.type';

interface RSIParameters extends StrategyParameters {
  period: number;
  overboughtLevel: number;
  oversoldLevel: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  positionSizePercentage: number;
  useTrailingStop: boolean;
  trailingStopPercentage?: number;
  // 额外的过滤条件
  useVolumeFilter: boolean;
  minVolume?: number;
  useTrendFilter: boolean;
  trendPeriod?: number;
}

export class RSIStrategy extends BaseStrategy {
  private params: RSIParameters;
  private highestPrice: number = 0;
  private lowestPrice: number = Infinity;

  constructor(parameters: RSIParameters) {
    super(parameters);
    this.params = parameters;

    // 参数验证
    if (this.params.period < 2) throw new Error('RSI周期必须大于1');
    if (this.params.overboughtLevel <= this.params.oversoldLevel) {
      throw new Error('超买水平必须大于超卖水平');
    }
    if (this.params.overboughtLevel > 100 || this.params.oversoldLevel < 0) {
      throw new Error('RSI水平必须在0-100之间');
    }
    if (this.params.stopLossPercentage <= 0) throw new Error('止损百分比必须大于0');
    if (this.params.takeProfitPercentage <= 0) throw new Error('止盈百分比必须大于0');
    if (this.params.positionSizePercentage <= 0 || this.params.positionSizePercentage > 100) {
      throw new Error('仓位大小百分比必须在0-100之间');
    }
  }

  async generateSignal(
    currentKline: Kline,
    historicalKlines: Kline[],
  ): Promise<StrategySignal | null> {
    if (historicalKlines.length < this.params.period + 1) {
      return null;
    }

    const prices = historicalKlines.map((k) => Number(k.close));
    const volumes = historicalKlines.map((k) => Number(k.volume));
    const currentPrice = Number(currentKline.close);
    const currentVolume = Number(currentKline.volume);

    // 检查交易量过滤器
    if (this.params.useVolumeFilter && this.params.minVolume) {
      const averageVolume = this.calculateSMA(volumes.slice(-10), 10);
      if (currentVolume < averageVolume * this.params.minVolume) {
        return null;
      }
    }

    // 检查趋势过滤器
    if (this.params.useTrendFilter && this.params.trendPeriod) {
      const sma = this.calculateSMA(prices.slice(-this.params.trendPeriod), this.params.trendPeriod);
      if (currentPrice < sma) {
        // 在下跌趋势中只允许做空
        return null;
      }
    }

    // 计算RSI
    const rsiValues = this.calculateRSI(prices, this.params.period);
    if (rsiValues.length < 2) return null;
    
    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues[rsiValues.length - 2];

    // 生成交易信号
    if (previousRSI <= this.params.oversoldLevel && currentRSI > this.params.oversoldLevel) {
      // RSI从超卖区域反弹，买入信号
      return {
        side: 'BUY',
        type: 'MARKET',
        price: currentPrice,
        stopLoss: this.calculateStopLoss('BUY', currentPrice, this.params.stopLossPercentage),
        takeProfit: this.calculateTakeProfit('BUY', currentPrice, this.params.takeProfitPercentage),
      };
    } else if (previousRSI >= this.params.overboughtLevel && currentRSI < this.params.overboughtLevel) {
      // RSI从超买区域回落，卖出信号
      return {
        side: 'SELL',
        type: 'MARKET',
        price: currentPrice,
        stopLoss: this.calculateStopLoss('SELL', currentPrice, this.params.stopLossPercentage),
        takeProfit: this.calculateTakeProfit('SELL', currentPrice, this.params.takeProfitPercentage),
      };
    }

    return null;
  }

  async shouldExit(currentKline: Kline, position: StrategyPosition): Promise<boolean> {
    const currentPrice = Number(currentKline.close);

    // 更新最高/最低价格
    if (position.side === 'BUY') {
      this.highestPrice = Math.max(this.highestPrice, currentPrice);
    } else {
      this.lowestPrice = Math.min(this.lowestPrice, currentPrice);
    }

    // 检查移动止损
    if (this.params.useTrailingStop && this.params.trailingStopPercentage) {
      const trailingStop = this.calculateTrailingStop(
        position.side,
        this.highestPrice,
        this.lowestPrice,
        this.params.trailingStopPercentage,
      );

      if (position.side === 'BUY' && currentPrice <= trailingStop) {
        return true;
      }
      if (position.side === 'SELL' && currentPrice >= trailingStop) {
        return true;
      }
    }

    // 检查固定止损
    if (position.stopLoss) {
      if (
        (position.side === 'BUY' && currentPrice <= position.stopLoss) ||
        (position.side === 'SELL' && currentPrice >= position.stopLoss)
      ) {
        return true;
      }
    }

    // 检查止盈
    if (position.takeProfit) {
      if (
        (position.side === 'BUY' && currentPrice >= position.takeProfit) ||
        (position.side === 'SELL' && currentPrice <= position.takeProfit)
      ) {
        return true;
      }
    }

    return false;
  }

  async calculatePositionSize(equity: number, price: number): Promise<number> {
    const positionValue = equity * (this.params.positionSizePercentage / 100);
    return positionValue / price;
  }

  // 重置最高/最低价格
  resetPriceLevels(): void {
    this.highestPrice = 0;
    this.lowestPrice = Infinity;
  }
} 