import { Prisma } from '@prisma/client';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export type Trade = {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  profitPercent?: number;
  pnl?: string;
  fee?: string;
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type Order = {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  quantity: string;
  leverage: number;
  margin: string;
  timeInForce: string;
  status: string;
  filledQty: string;
  remainingQty?: string | null;
  createdAt: Date;
  updatedAt: Date;
  positionId?: string | null;
  user?: {
    id: string;
    email: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
  };
  position?: Position;
};

export type Position = {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  quantity: string;
  entryPrice: string;
  leverage: number;
  liquidationPrice: string;
  margin: string;
  unrealizedPnl: string;
  realizedPnl: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    username: string;
    createdAt: Date;
    updatedAt: Date;
  };
  orders?: Order[];
};

export interface MatchResult {
  trades: Trade[];
  remainingOrder?: Order;
}

export interface OrderBookEntry {
  price: string;
  quantity: string;
  total: string;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface TradingPair {
  id?: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TradeCreateData = Prisma.TradeCreateInput;
export type OrderCreateData = Prisma.OrderCreateInput;
export type PositionCreateData = Prisma.PositionCreateInput;

export type TradeUpdateData = Prisma.TradeUpdateInput;
export type OrderUpdateData = Prisma.OrderUpdateInput;
export type PositionUpdateData = Prisma.PositionUpdateInput;
