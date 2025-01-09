export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  LIMIT = 'limit',
  MARKET = 'market',
  STOP_LIMIT = 'stop_limit',
  STOP_MARKET = 'stop_market',
}

export enum OrderStatus {
  PENDING = 'pending',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum OrderTimeInForce {
  GTC = 'GTC', // Good Till Cancel
  IOC = 'IOC', // Immediate or Cancel
  FOK = 'FOK', // Fill or Kill
}

export interface Order {
  id: string;
  userId: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  amount: number;
  filled: number;
  remaining?: number;
  status: OrderStatus;
  timeInForce?: OrderTimeInForce;
  stopPrice?: number;
  leverage?: number;
  margin?: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Trade {
  id: string;
  symbol: string;
  makerOrderId: string;
  takerOrderId: string;
  makerUserId: string;
  takerUserId: string;
  price: number;
  amount: number;
  leverage?: number;
  profit?: number;
  profitPercent?: number;
  margin?: number;
  createdAt: Date;
}

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  amount: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  stopLoss?: number;
  takeProfit?: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  count: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface TradeStatistics {
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
}

export interface OrderMatchResult {
  trades: Trade[];
  remainingOrder?: Order;
}

export interface OrderBookUpdate {
  symbol: string;
  side: OrderSide;
  price: number;
  amount: number;
  timestamp: number;
}

export interface WebSocketSubscription {
  symbol: string;
  channel: 'orderbook' | 'trades' | 'ticker';
}

export interface WebSocketMessage<T = any> {
  event: string;
  data: T;
}
