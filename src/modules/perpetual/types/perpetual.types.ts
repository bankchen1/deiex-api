export enum PerpetualOrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
  TAKE_PROFIT = 'TAKE_PROFIT',
  STOP_MARKET = 'STOP_MARKET',
  TAKE_PROFIT_MARKET = 'TAKE_PROFIT_MARKET',
}

export enum PositionSide {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export enum MarginType {
  ISOLATED = 'ISOLATED',
  CROSS = 'CROSS',
}

export interface PerpetualOrder {
  id: string;
  userId: string;
  symbol: string;
  side: PositionSide;
  type: PerpetualOrderType;
  price: number;
  amount: number;
  leverage: number;
  marginType: MarginType;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  reduceOnly: boolean;
  status: OrderStatus;
  filled: number;
  avgPrice: number;
  fee: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: PositionSide;
  amount: number;
  leverage: number;
  marginType: MarginType;
  entryPrice: number;
  liquidationPrice: number;
  bankruptcy: number;
  margin: number;
  isolatedMargin?: number;
  unrealizedPnl: number;
  realizedPnl: number;
  maintMargin: number;
  marginRatio: number;
  lastUpdateTime: Date;
}

export interface FundingRate {
  symbol: string;
  rate: number;
  timestamp: number;
}

export interface InsuranceFund {
  id: string;
  symbol: string;
  balance: number;
  totalInjection: number;
  totalPayouts: number;
  lastUpdateTime: Date;
}

export interface LiquidationOrder {
  id: string;
  positionId: string;
  userId: string;
  symbol: string;
  side: PositionSide;
  amount: number;
  price: number;
  liquidationFee: number;
  timestamp: Date;
}

export interface PerpetualConfig {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  tickSize: number;
  lotSize: number;
  maxLeverage: number;
  maintMarginRatio: number;
  initialMarginRatio: number;
  maxPrice: number;
  minPrice: number;
  maxQuantity: number;
  minQuantity: number;
  fundingInterval: number;
  insuranceFundFactor: number;
}

export interface MarginLevel {
  leverage: number;
  maintMarginRatio: number;
  initialMarginRatio: number;
}

export interface FundingInfo {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  lastFundingRate: number;
  nextFundingTime: number;
  interestRate: number;
}

export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}
