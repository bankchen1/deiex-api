import { ApiProperty } from '@nestjs/swagger';

export class KlineDto {
  @ApiProperty({ description: 'Kline open time' })
  openTime: number;

  @ApiProperty({ description: 'Open price' })
  open: string;

  @ApiProperty({ description: 'High price' })
  high: string;

  @ApiProperty({ description: 'Low price' })
  low: string;

  @ApiProperty({ description: 'Close price' })
  close: string;

  @ApiProperty({ description: 'Volume' })
  volume: string;

  @ApiProperty({ description: 'Kline close time' })
  closeTime: number;

  @ApiProperty({ description: 'Quote asset volume' })
  quoteAssetVolume: string;

  @ApiProperty({ description: 'Number of trades' })
  trades: number;

  @ApiProperty({ description: 'Taker buy base asset volume' })
  takerBuyBaseAssetVolume: string;

  @ApiProperty({ description: 'Taker buy quote asset volume' })
  takerBuyQuoteAssetVolume: string;
}
