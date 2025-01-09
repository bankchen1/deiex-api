import { StrategyError } from '../errors/strategy.error';
import { StrategyType } from '../types/strategy.type';
import { StrategyParameters } from '../types/strategy-parameters.type';

export class StrategyValidation {
  validateParameters(type: StrategyType, parameters: StrategyParameters): void {
    // 验证基本参数
    this.validateBaseParameters(parameters);

    // 根据策略类型验证特定参数
    switch (type) {
      case 'MA_CROSSOVER':
        this.validateMACrossoverParameters(parameters);
        break;
      case 'MACD':
        this.validateMACDParameters(parameters);
        break;
      case 'RSI':
        this.validateRSIParameters(parameters);
        break;
      case 'BOLLINGER_BANDS':
        this.validateBollingerBandsParameters(parameters);
        break;
      case 'GRID_TRADING':
        this.validateGridTradingParameters(parameters);
        break;
      case 'ICHIMOKU':
        this.validateIchimokuParameters(parameters);
        break;
      case 'DUAL_THRUST':
        this.validateDualThrustParameters(parameters);
        break;
      default:
        throw new StrategyError(`Unsupported strategy type: ${type}`);
    }
  }

  private validateBaseParameters(parameters: StrategyParameters): void {
    if (!parameters.symbol) {
      throw new StrategyError('Trading symbol is required');
    }
    if (!parameters.interval) {
      throw new StrategyError('Time interval is required');
    }
    if (!parameters.stopLossPercentage) {
      throw new StrategyError('Stop loss percentage is required');
    }
    if (!parameters.takeProfitPercentage) {
      throw new StrategyError('Take profit percentage is required');
    }
    if (!parameters.positionSizePercentage) {
      throw new StrategyError('Position size percentage is required');
    }

    // 验证数值范围
    if (parameters.stopLossPercentage <= 0) {
      throw new StrategyError('Stop loss percentage must be greater than 0');
    }
    if (parameters.takeProfitPercentage <= 0) {
      throw new StrategyError('Take profit percentage must be greater than 0');
    }
    if (parameters.positionSizePercentage <= 0 || parameters.positionSizePercentage > 100) {
      throw new StrategyError('Position size percentage must be between 0 and 100');
    }
  }

  private validateMACrossoverParameters(parameters: StrategyParameters): void {
    if (!parameters.fastPeriod) {
      throw new StrategyError('Fast period is required for MA Crossover strategy');
    }
    if (!parameters.slowPeriod) {
      throw new StrategyError('Slow period is required for MA Crossover strategy');
    }
    if (parameters.fastPeriod >= parameters.slowPeriod) {
      throw new StrategyError('Fast period must be less than slow period');
    }
  }

  private validateMACDParameters(parameters: StrategyParameters): void {
    if (!parameters.fastPeriod) {
      throw new StrategyError('Fast period is required for MACD strategy');
    }
    if (!parameters.slowPeriod) {
      throw new StrategyError('Slow period is required for MACD strategy');
    }
    if (!parameters.signalPeriod) {
      throw new StrategyError('Signal period is required for MACD strategy');
    }
    if (parameters.fastPeriod >= parameters.slowPeriod) {
      throw new StrategyError('Fast period must be less than slow period');
    }
  }

  private validateRSIParameters(parameters: StrategyParameters): void {
    if (!parameters.period) {
      throw new StrategyError('Period is required for RSI strategy');
    }
    if (!parameters.overboughtLevel) {
      throw new StrategyError('Overbought level is required for RSI strategy');
    }
    if (!parameters.oversoldLevel) {
      throw new StrategyError('Oversold level is required for RSI strategy');
    }
    if (parameters.overboughtLevel <= parameters.oversoldLevel) {
      throw new StrategyError('Overbought level must be greater than oversold level');
    }
  }

  private validateBollingerBandsParameters(parameters: StrategyParameters): void {
    if (!parameters.period) {
      throw new StrategyError('Period is required for Bollinger Bands strategy');
    }
    if (!parameters.multiplier) {
      throw new StrategyError('Multiplier is required for Bollinger Bands strategy');
    }
    if (parameters.multiplier <= 0) {
      throw new StrategyError('Multiplier must be greater than 0');
    }
  }

  private validateGridTradingParameters(parameters: StrategyParameters): void {
    if (!parameters.gridCount) {
      throw new StrategyError('Grid count is required for Grid Trading strategy');
    }
    if (!parameters.gridSpacing) {
      throw new StrategyError('Grid spacing is required for Grid Trading strategy');
    }
    if (parameters.gridCount < 2) {
      throw new StrategyError('Grid count must be at least 2');
    }
    if (parameters.gridSpacing <= 0) {
      throw new StrategyError('Grid spacing must be greater than 0');
    }
  }

  private validateIchimokuParameters(parameters: StrategyParameters): void {
    if (!parameters.conversionPeriod) {
      throw new StrategyError('Conversion period is required for Ichimoku strategy');
    }
    if (!parameters.basePeriod) {
      throw new StrategyError('Base period is required for Ichimoku strategy');
    }
    if (!parameters.spanPeriod) {
      throw new StrategyError('Span period is required for Ichimoku strategy');
    }
    if (!parameters.displacement) {
      throw new StrategyError('Displacement is required for Ichimoku strategy');
    }
  }

  private validateDualThrustParameters(parameters: StrategyParameters): void {
    if (!parameters.lookbackPeriod) {
      throw new StrategyError('Lookback period is required for Dual Thrust strategy');
    }
    if (!parameters.upperMultiplier) {
      throw new StrategyError('Upper multiplier is required for Dual Thrust strategy');
    }
    if (!parameters.lowerMultiplier) {
      throw new StrategyError('Lower multiplier is required for Dual Thrust strategy');
    }
    if (parameters.lookbackPeriod < 1) {
      throw new StrategyError('Lookback period must be at least 1');
    }
    if (parameters.upperMultiplier <= 0) {
      throw new StrategyError('Upper multiplier must be greater than 0');
    }
    if (parameters.lowerMultiplier <= 0) {
      throw new StrategyError('Lower multiplier must be greater than 0');
    }
  }
}
