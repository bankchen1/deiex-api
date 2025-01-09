import { PositionSide, MarginType } from '../../perpetual/types/perpetual.types';

export interface LiquidationEvent {
  userId: string;
  positionId: string;
  symbol: string;
  side: PositionSide;
  size: number;
  price: number;
  liquidationFee: number;
  marginType: MarginType;
  timestamp: Date;
}

export interface ADLEvent {
  userId: string;
  positionId: string;
  symbol: string;
  side: PositionSide;
  size: number;
  price: number;
  adlFee: number;
  marginType: MarginType;
  timestamp: Date;
}

export interface LiquidationQueue {
  symbol: string;
  side: PositionSide;
  positions: LiquidationPosition[];
  lastUpdateTime: Date;
}

export interface LiquidationPosition {
  positionId: string;
  userId: string;
  size: number;
  margin: number;
  marginRatio: number;
  bankruptcyPrice: number;
  priority: number;
}

export interface ADLQueue {
  symbol: string;
  side: PositionSide;
  positions: ADLPosition[];
  lastUpdateTime: Date;
}

export interface ADLPosition {
  positionId: string;
  userId: string;
  size: number;
  unrealizedPnl: number;
  roe: number; // Return on Equity
  priority: number;
  side: PositionSide;
  marginType: MarginType;
}

export interface InsuranceFundOperation {
  id: string;
  symbol: string;
  type: 'INJECTION' | 'PAYOUT';
  amount: number;
  reason: string;
  timestamp: Date;
}

export interface LiquidationStats {
  totalLiquidations: number;
  totalLiquidationVolume: number;
  totalLiquidationFees: number;
  insuranceFundBalance: number;
  totalInsuranceFundInjections: number;
  totalInsuranceFundPayouts: number;
}

export interface ADLStats {
  totalADLs: number;
  totalADLVolume: number;
  totalADLFees: number;
  averageADLPrice: number;
  mostADLedSymbol: string;
}

export enum LiquidationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ADLStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
