export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;  // 累计数量
  orders: number; // 订单数量
}

export interface OrderBookSide {
  levels: OrderBookLevel[];
  totalAmount: number;
  totalOrders: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookSide;
  asks: OrderBookSide;
  timestamp: number;
  lastUpdateId: number;
}

export interface MatchResult {
  orderId: string;
  matchedOrders: {
    orderId: string;
    price: number;
    amount: number;
    timestamp: number;
  }[];
  remainingAmount: number;
  status: 'FILLED' | 'PARTIALLY_FILLED' | 'NO_MATCH';
}

export interface OrderBookUpdate {
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  timestamp: number;
  updateId: number;
}
