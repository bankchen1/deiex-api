export interface BaseStrategyParameters {
  name: string;
  description?: string;
  symbol: string;
  interval: string;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  positionSizePercentage: number;
  useTrailingStop: boolean;
  trailingStopPercentage?: number;
  useVolumeFilter: boolean;
  minVolume?: number;
  useTrendFilter: boolean;
  trendPeriod?: number;
}

export interface MACrossoverParameters extends BaseStrategyParameters {
  fastPeriod: number;
  slowPeriod: number;
}

export interface MACDParameters extends BaseStrategyParameters {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface RSIParameters extends BaseStrategyParameters {
  period: number;
  overboughtLevel: number;
  oversoldLevel: number;
}

export interface BollingerBandsParameters extends BaseStrategyParameters {
  period: number;
  multiplier: number;
}

export interface GridTradingParameters extends BaseStrategyParameters {
  gridCount: number;
  gridSpacing: number;
}

export interface IchimokuParameters extends BaseStrategyParameters {
  conversionPeriod: number;
  basePeriod: number;
  spanPeriod: number;
  displacement: number;
}

export interface DualThrustParameters extends BaseStrategyParameters {
  lookbackPeriod: number;
  upperMultiplier: number;
  lowerMultiplier: number;
}

export type StrategyParameters =
  | MACrossoverParameters
  | MACDParameters
  | RSIParameters
  | BollingerBandsParameters
  | GridTradingParameters
  | IchimokuParameters
  | DualThrustParameters;