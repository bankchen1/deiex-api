import { ApiProperty } from '@nestjs/swagger';

export class OrderBookEntryDto {
  @ApiProperty({ description: 'Price level' })
  price: string;

  @ApiProperty({ description: 'Quantity at this price level' })
  quantity: string;
}

export class OrderBookDto {
  @ApiProperty({ description: 'Trading pair symbol' })
  symbol: string;

  @ApiProperty({ description: 'List of bid orders', type: [OrderBookEntryDto] })
  bids: OrderBookEntryDto[];

  @ApiProperty({ description: 'List of ask orders', type: [OrderBookEntryDto] })
  asks: OrderBookEntryDto[];

  @ApiProperty({ description: 'Order book timestamp' })
  timestamp: number;
}
