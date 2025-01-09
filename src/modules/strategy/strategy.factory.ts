import { Injectable, Logger } from '@nestjs/common';
import { BaseStrategy } from './templates/base-strategy';
import { MACrossoverStrategy } from './templates/ma-crossover-strategy';
import { MACDStrategy } from './templates/macd-strategy';
import { RSIStrategy } from './templates/rsi-strategy';
import { BollingerBandsStrategy } from './templates/bollinger-bands-strategy';
import { GridTradingStrategy } from './templates/grid-trading-strategy';
import { IchimokuStrategy } from './templates/ichimoku-strategy';
import { DualThrustStrategy } from './templates/dual-thrust-strategy';
import { StrategyError } from './errors/strategy.error';
import { MarketService } from '../market/market.service';
import { StrategyType } from './types/strategy.type';
import { StrategyParameters } from './types/strategy-parameters.type';
import { StrategyValidation } from './validations/strategy.validation';

@Injectable()
export class StrategyFactory {
  private readonly logger = new Logger(StrategyFactory.name);
  private readonly validation: StrategyValidation;

  constructor(private readonly marketService: MarketService) {
    this.validation = new StrategyValidation();
  }

  async createStrategy(
    type: StrategyType,
    parameters: StrategyParameters,
  ): Promise<BaseStrategy> {
    try {
      // 验证交易对是否有效
      const isValidSymbol = await this.marketService.validateSymbol(parameters.symbol);
      if (!isValidSymbol) {
        throw new StrategyError(`Invalid symbol: ${parameters.symbol}`);
      }

      // 验证参数
      this.validation.validateParameters(type, parameters);

      // 创建策略实例
      const strategy = this.instantiateStrategy(type, parameters);

      // 初始化策略
      await strategy.initialize();

      return strategy;
    } catch (error) {
      this.logger.error(`Failed to create strategy: ${error.message}`, error.stack);
      throw new StrategyError(`Failed to create strategy: ${error.message}`);
    }
  }

  getStrategyTypes(): StrategyType[] {
    return [
      'MA_CROSSOVER',
      'MACD',
      'RSI',
      'BOLLINGER_BANDS',
      'GRID_TRADING',
      'ICHIMOKU',
      'DUAL_THRUST',
    ];
  }

  async getDefaultParameters(type: StrategyType): Promise<StrategyParameters> {
    try {
      const baseParams: Partial<StrategyParameters> = {
        stopLossPercentage: 2,
        takeProfitPercentage: 4,
        positionSizePercentage: 10,
        useTrailingStop: true,
        trailingStopPercentage: 1,
        useVolumeFilter: false,
        useTrendFilter: false,
        interval: '1h',
      };

      const specificParams = this.getSpecificParameters(type);
      return { ...baseParams, ...specificParams } as StrategyParameters;
    } catch (error) {
      this.logger.error(
        `Failed to get default parameters: ${error.message}`,
        error.stack,
      );
      throw new StrategyError(`Failed to get default parameters: ${error.message}`);
    }
  }

  private instantiateStrategy(
    type: StrategyType,
    parameters: StrategyParameters,
  ): BaseStrategy {
    try {
      switch (type) {
        case 'MA_CROSSOVER':
          return new MACrossoverStrategy(parameters);
        case 'MACD':
          return new MACDStrategy(parameters);
        case 'RSI':
          return new RSIStrategy(parameters);
        case 'BOLLINGER_BANDS':
          return new BollingerBandsStrategy(parameters);
        case 'GRID_TRADING':
          return new GridTradingStrategy(parameters);
        case 'ICHIMOKU':
          return new IchimokuStrategy(parameters);
        case 'DUAL_THRUST':
          return new DualThrustStrategy(parameters);
        default:
          throw new StrategyError(`Unsupported strategy type: ${type}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to instantiate strategy: ${error.message}`,
        error.stack,
      );
      throw new StrategyError(`Failed to instantiate strategy: ${error.message}`);
    }
  }

  private getSpecificParameters(type: StrategyType): Partial<StrategyParameters> {
    switch (type) {
      case 'MA_CROSSOVER':
        return {
          fastPeriod: 10,
          slowPeriod: 20,
        };
      case 'MACD':
        return {
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
        };
      case 'RSI':
        return {
          period: 14,
          overboughtLevel: 70,
          oversoldLevel: 30,
        };
      case 'BOLLINGER_BANDS':
        return {
          period: 20,
          multiplier: 2,
        };
      case 'GRID_TRADING':
        return {
          gridCount: 10,
          gridSpacing: 1,
        };
      case 'ICHIMOKU':
        return {
          conversionPeriod: 9,
          basePeriod: 26,
          spanPeriod: 52,
          displacement: 26,
        };
      case 'DUAL_THRUST':
        return {
          lookbackPeriod: 4,
          upperMultiplier: 0.7,
          lowerMultiplier: 0.7,
        };
      default:
        throw new StrategyError(`Unsupported strategy type: ${type}`);
    }
  }
}