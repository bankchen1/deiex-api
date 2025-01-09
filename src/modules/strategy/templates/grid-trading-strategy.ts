import { BaseStrategy, StrategyParameters, StrategySignal, StrategyPosition } from './base-strategy';
import { Kline } from '../types/kline.type';

interface GridTradingParameters extends StrategyParameters {
  upperPrice: number;
  lowerPrice: number;
  gridCount: number;
  positionSizePercentage: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  useTrailingStop: boolean;
  trailingStopPercentage?: number;
  // 额外的过滤条件
  useVolumeFilter: boolean;
  minVolume?: number;
  useTrendFilter: boolean;
  trendPeriod?: number;
}

interface GridLevel {
  price: number;
  side: 'BUY' | 'SELL';
  isActive: boolean;
}

export class GridTradingStrategy extends BaseStrategy {
  private params: GridTradingParameters;
  private gridLevels: GridLevel[] = [];
  private highestPrice: number = 0;
  private lowestPrice: number = Infinity;

  constructor(parameters: GridTradingParameters) {
    super(parameters);
    this.params = parameters;

    // 参数验证
    if (this.params.upperPrice <= this.params.lowerPrice) {
      throw new Error('上限价格必须大于下限价格');
    }
    if (this.params.gridCount < 2) throw new Error('网格数量必须大于1');
    if (this.params.positionSizePercentage <= 0 || this.params.positionSizePercentage > 100) {
      throw new Error('仓位大小百分比必须在0-100之间');
    }
    if (this.params.stopLossPercentage <= 0) throw new Error('止损百分比必须大于0');
    if (this.params.takeProfitPercentage <= 0) throw new Error('止盈百分比必须大于0');

    // 初始化网格
    this.initializeGrid();
  }

  private initializeGrid(): void {
    const priceStep = (this.params.upperPrice - this.params.lowerPrice) / (this.params.gridCount - 1);
    
    for (let i = 0; i < this.params.gridCount; i++) {
      const price = this.params.lowerPrice + i * priceStep;
      this.gridLevels.push({
        price,
        side: i < this.params.gridCount - 1 ? 'BUY' : 'SELL',
        isActive: true,
      });
    }
  }

  async generateSignal(
    currentKline: Kline,
    historicalKlines: Kline[],
  ): Promise<StrategySignal | null> {
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

    // 找到当前价格所在的网格区间
    const activeGridLevels = this.gridLevels.filter((level) => level.isActive);
    for (const level of activeGridLevels) {
      if (level.side === 'BUY' && currentPrice <= level.price) {
        // 价格触及买入网格线
        level.isActive = false; // 标记该网格线已被触发
        return {
          side: 'BUY',
          type: 'LIMIT',
          price: level.price,
          stopLoss: this.calculateStopLoss('BUY', level.price, this.params.stopLossPercentage),
          takeProfit: this.calculateTakeProfit('BUY', level.price, this.params.takeProfitPercentage),
        };
      } else if (level.side === 'SELL' && currentPrice >= level.price) {
        // 价格触及卖出网格线
        level.isActive = false; // 标记该网格线已被触发
        return {
          side: 'SELL',
          type: 'LIMIT',
          price: level.price,
          stopLoss: this.calculateStopLoss('SELL', level.price, this.params.stopLossPercentage),
          takeProfit: this.calculateTakeProfit('SELL', level.price, this.params.takeProfitPercentage),
        };
      }
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
        // 重新激活相应的网格线
        this.resetGridLevel(position.side === 'BUY' ? position.takeProfit : position.entryPrice);
        return true;
      }
    }

    return false;
  }

  async calculatePositionSize(equity: number, price: number): Promise<number> {
    const positionValue = equity * (this.params.positionSizePercentage / 100) / this.params.gridCount;
    return positionValue / price;
  }

  // 重置网格线状态
  private resetGridLevel(price: number): void {
    const level = this.gridLevels.find((l) => Math.abs(l.price - price) < 0.0001);
    if (level) {
      level.isActive = true;
    }
  }

  // 重置所有网格线状态
  resetGrid(): void {
    this.gridLevels.forEach((level) => {
      level.isActive = true;
    });
    this.highestPrice = 0;
    this.lowestPrice = Infinity;
  }
} 