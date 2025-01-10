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

export interface UserInfo {
  id: string;
  email: string;
  username: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  profitPercent?: number | null;
  pnl?: string | null;
  fee?: string | null;
  makerOrderId?: string | null;
  takerOrderId?: string | null;
  makerUserId?: string | null;
  takerUserId?: string | null;
  orderId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: UserInfo;
}

export interface Order {
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
  user?: UserInfo;
  position?: Position;
}

export interface Position {
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
  user?: UserInfo;
  orders?: Order[];
}

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
