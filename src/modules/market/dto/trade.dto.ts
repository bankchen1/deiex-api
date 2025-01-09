import { ApiProperty } from '@nestjs/swagger';

export class TradeDto {
  @ApiProperty({ description: 'Trade ID' })
  id: string;

  @ApiProperty({ description: 'Trading pair symbol' })
  symbol: string;

  @ApiProperty({ description: 'Trade price' })
  price: string;

  @ApiProperty({ description: 'Trade quantity' })
  quantity: string;

  @ApiProperty({ description: 'Trade quote quantity (price * quantity)' })
  quoteQuantity: string;

  @ApiProperty({ description: 'Trade timestamp' })
  time: number;

  @ApiProperty({ description: 'Whether the buyer was the maker' })
  isBuyerMaker: boolean;
}
