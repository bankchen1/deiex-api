export interface Kline {
  id: string;
  symbol: string;
  interval: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  createdAt: Date;
  updatedAt: Date;
} 