export class TradeDto {
  id: string;
  price: number;
  quantity: number;
  side: string;
  createdAt: Date;
}

export class TradeHistoryDto {
  symbol: string;
  trades: TradeDto[];
} 