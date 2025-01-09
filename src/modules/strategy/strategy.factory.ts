import { Injectable } from '@nestjs/common';
import { BaseStrategy } from './templates/base-strategy';
import { MACrossoverStrategy } from './templates/ma-crossover-strategy';
import { MACDStrategy } from './templates/macd-strategy';
import { RSIStrategy } from './templates/rsi-strategy';
import { BollingerBandsStrategy } from './templates/bollinger-bands-strategy';
import { GridTradingStrategy } from './templates/grid-trading-strategy';
import {
  BaseStrategyParameters,
  MACrossoverParameters,
  MACDParameters,
  RSIParameters,
  BollingerBandsParameters,
  GridTradingParameters,
} from './types/strategy-parameters.type';

export type StrategyType = 'MA_CROSSOVER' | 'MACD' | 'RSI' | 'BOLLINGER_BANDS' | 'GRID_TRADING';

@Injectable()
export class StrategyFactory {
  createStrategy(type: StrategyType, parameters: BaseStrategyParameters): BaseStrategy {
    switch (type) {
      case 'MA_CROSSOVER':
        return new MACrossoverStrategy(parameters as MACrossoverParameters);
      case 'MACD':
        return new MACDStrategy(parameters as MACDParameters);
      case 'RSI':
        return new RSIStrategy(parameters as RSIParameters);
      case 'BOLLINGER_BANDS':
        return new BollingerBandsStrategy(parameters as BollingerBandsParameters);
      case 'GRID_TRADING':
        return new GridTradingStrategy(parameters as GridTradingParameters);
      default:
        throw new Error(`不支持的策略类型: ${type}`);
    }
  }

  getStrategyTypes(): StrategyType[] {
    return ['MA_CROSSOVER', 'MACD', 'RSI', 'BOLLINGER_BANDS', 'GRID_TRADING'];
  }

  getDefaultParameters(type: StrategyType): Partial<BaseStrategyParameters> {
    const baseParams: Partial<BaseStrategyParameters> = {
      stopLossPercentage: 2,
      takeProfitPercentage: 4,
      positionSizePercentage: 10,
      useTrailingStop: true,
      trailingStopPercentage: 1,
      useVolumeFilter: false,
      useTrendFilter: false,
    };

    switch (type) {
      case 'MA_CROSSOVER':
        return {
          ...baseParams,
          fastPeriod: 10,
          slowPeriod: 20,
        } as Partial<MACrossoverParameters>;
      case 'MACD':
        return {
          ...baseParams,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        } as Partial<MACDParameters>;
      case 'RSI':
        return {
          ...baseParams,
          period: 14,
          overboughtLevel: 70,
          oversoldLevel: 30,
        } as Partial<RSIParameters>;
      case 'BOLLINGER_BANDS':
        return {
          ...baseParams,
          period: 20,
          multiplier: 2,
        } as Partial<BollingerBandsParameters>;
      case 'GRID_TRADING':
        return {
          ...baseParams,
          upperPrice: 0, // 需要根据当前市场价格动态设置
          lowerPrice: 0, // 需要根据当前市场价格动态设置
          gridCount: 10,
        } as Partial<GridTradingParameters>;
      default:
        throw new Error(`不支持的策略类型: ${type}`);
    }
  }

  validateParameters(type: StrategyType, parameters: BaseStrategyParameters): void {
    // 基本参数验证
    if (!parameters.name) throw new Error('策略名称不能为空');
    if (!parameters.symbol) throw new Error('交易对不能为空');
    if (!parameters.interval) throw new Error('时间间隔不能为空');
    if (!parameters.stopLossPercentage) throw new Error('止损百分比不能为空');
    if (!parameters.takeProfitPercentage) throw new Error('止盈百分比不能为空');
    if (!parameters.positionSizePercentage) throw new Error('仓位大小百分比不能为空');

    // 根据策略类型进行特定验证
    switch (type) {
      case 'MA_CROSSOVER':
        this.validateMACrossoverParameters(parameters as MACrossoverParameters);
        break;
      case 'MACD':
        this.validateMACDParameters(parameters as MACDParameters);
        break;
      case 'RSI':
        this.validateRSIParameters(parameters as RSIParameters);
        break;
      case 'BOLLINGER_BANDS':
        this.validateBollingerBandsParameters(parameters as BollingerBandsParameters);
        break;
      case 'GRID_TRADING':
        this.validateGridTradingParameters(parameters as GridTradingParameters);
        break;
      default:
        throw new Error(`不支持的策略类型: ${type}`);
    }
  }

  private validateMACrossoverParameters(parameters: MACrossoverParameters): void {
    if (!parameters.fastPeriod) throw new Error('快速周期不能为空');
    if (!parameters.slowPeriod) throw new Error('慢速周期不能为空');
    if (parameters.fastPeriod >= parameters.slowPeriod) {
      throw new Error('快速周期必须小于慢速周期');
    }
  }

  private validateMACDParameters(parameters: MACDParameters): void {
    if (!parameters.fastPeriod) throw new Error('快速周期不能为空');
    if (!parameters.slowPeriod) throw new Error('慢速周期不能为空');
    if (!parameters.signalPeriod) throw new Error('信号周期不能为空');
    if (parameters.fastPeriod >= parameters.slowPeriod) {
      throw new Error('快速周期必须小于慢速周期');
    }
  }

  private validateRSIParameters(parameters: RSIParameters): void {
    if (!parameters.period) throw new Error('RSI周期不能为空');
    if (!parameters.overboughtLevel) throw new Error('超买水平不能为空');
    if (!parameters.oversoldLevel) throw new Error('超卖水平不能为空');
    if (parameters.overboughtLevel <= parameters.oversoldLevel) {
      throw new Error('超买水平必须大于超卖水平');
    }
  }

  private validateBollingerBandsParameters(parameters: BollingerBandsParameters): void {
    if (!parameters.period) throw new Error('布林带周期不能为空');
    if (!parameters.multiplier) throw new Error('布林带乘数不能为空');
    if (parameters.multiplier <= 0) throw new Error('布林带乘数必须大于0');
  }

  private validateGridTradingParameters(parameters: GridTradingParameters): void {
    if (!parameters.upperPrice) throw new Error('上限价格不能为空');
    if (!parameters.lowerPrice) throw new Error('下限价格不能为空');
    if (!parameters.gridCount) throw new Error('网格数量不能为空');
    if (parameters.upperPrice <= parameters.lowerPrice) {
      throw new Error('上限价格必须大于下限价格');
    }
    if (parameters.gridCount < 2) throw new Error('网格数量必须大于1');
  }
} 