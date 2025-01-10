export class TradeDto {
  id: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  createdAt: Date;
}

export class TradeHistoryDto {
  symbol: string;
  trades: TradeDto[];
} 