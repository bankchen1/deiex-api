import { ApiProperty } from '@nestjs/swagger';

export class TickerDto {
  @ApiProperty({ description: 'Trading pair symbol' })
  symbol: string;

  @ApiProperty({ description: 'Latest price' })
  price: string;

  @ApiProperty({ description: 'Price change' })
  priceChange: string;

  @ApiProperty({ description: 'Price change percent' })
  priceChangePercent: string;

  @ApiProperty({ description: 'Trading volume in base asset' })
  volume: string;

  @ApiProperty({ description: 'Trading volume in quote asset' })
  quoteVolume: string;

  @ApiProperty({ description: 'Highest price in 24h' })
  high: string;

  @ApiProperty({ description: 'Lowest price in 24h' })
  low: string;

  @ApiProperty({ description: 'Open price 24h ago' })
  openPrice: string;
}
