export class OrderBookEntryDto {
  price: number;
  quantity: number;
}

export class OrderBookDto {
  symbol: string;
  bids: OrderBookEntryDto[];
  asks: OrderBookEntryDto[];
  timestamp: number;
}
