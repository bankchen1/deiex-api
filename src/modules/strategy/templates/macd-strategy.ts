import { BaseStrategy } from './base-strategy';
import { Kline } from '../types/kline.type';
import { OrderSide, OrderType } from '../types/order.type';

export interface MACDParameters {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  riskPercentage: number;
}

export class MACDStrategy extends BaseStrategy {
  protected name = 'MACD Strategy';
  protected description = 'Moving Average Convergence Divergence (MACD) Strategy';
  protected parameters: MACDParameters;

  constructor(parameters: MACDParameters) {
    super();
    this.parameters = {
      fastPeriod: parameters.fastPeriod || 12,
      slowPeriod: parameters.slowPeriod || 26,
      signalPeriod: parameters.signalPeriod || 9,
      stopLossPercentage: parameters.stopLossPercentage || 0.02,
      takeProfitPercentage: parameters.takeProfitPercentage || 0.04,
      riskPercentage: parameters.riskPercentage || 0.01
    };
  }

  generateSignals(klines: Kline[]): {
    side: OrderSide | null;
    type: OrderType;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
  }[] {
    const closePrices = klines.map(k => k.close);
    const { macd, signal } = this.calculateMACD(
      closePrices,
      this.parameters.fastPeriod,
      this.parameters.slowPeriod,
      this.parameters.signalPeriod
    );

    const signals: {
      side: OrderSide | null;
      type: OrderType;
      price: number;
      stopLoss?: number;
      takeProfit?: number;
    }[] = [];

    // 从倒数第二个数据点开始分析,因为我们需要比较前后两个点
    for (let i = macd.length - 2; i >= 0; i--) {
      const currentPrice = closePrices[i];
      let side: OrderSide | null = null;

      // MACD金叉: MACD线从下方穿过信号线
      if (macd[i] > signal[i] && macd[i - 1] <= signal[i - 1]) {
        side = OrderSide.BUY;
      }
      // MACD死叉: MACD线从上方穿过信号线
      else if (macd[i] < signal[i] && macd[i - 1] >= signal[i - 1]) {
        side = OrderSide.SELL;
      }

      if (side !== null) {
        const stopLoss = this.calculateStopLoss(
          currentPrice,
          side,
          this.parameters.stopLossPercentage
        );
        const takeProfit = this.calculateTakeProfit(
          currentPrice,
          side,
          this.parameters.takeProfitPercentage
        );

        signals.push({
          side,
          type: OrderType.MARKET,
          price: currentPrice,
          stopLoss,
          takeProfit
        });
      }
    }

    return signals;
  }

  calculatePositionSize(balance: number, price: number, risk: number): number {
    const riskAmount = balance * this.parameters.riskPercentage;
    const stopLossDistance = price * this.parameters.stopLossPercentage;
    return riskAmount / stopLossDistance;
  }

  determineExitConditions(
    position: {
      side: OrderSide;
      entryPrice: number;
      size: number;
      stopLoss?: number;
      takeProfit?: number;
    },
    currentPrice: number
  ): boolean {
    // 检查是否触及止损或止盈
    if (position.stopLoss && position.takeProfit) {
      if (position.side === OrderSide.BUY) {
        if (currentPrice <= position.stopLoss || currentPrice >= position.takeProfit) {
          return true;
        }
      } else {
        if (currentPrice >= position.stopLoss || currentPrice <= position.takeProfit) {
          return true;
        }
      }
    }
    return false;
  }
} 