import { ApiProperty } from '@nestjs/swagger';
import { TickerDto } from './ticker.dto';

export class MarketOverviewDto {
  @ApiProperty({ description: 'Total trading volume in quote currency' })
  totalVolume: string;

  @ApiProperty({ description: 'Total number of trades' })
  totalTrades: number;

  @ApiProperty({ description: 'Top gainers in the last 24h', type: [TickerDto] })
  topGainers: TickerDto[];

  @ApiProperty({ description: 'Top losers in the last 24h', type: [TickerDto] })
  topLosers: TickerDto[];

  @ApiProperty({ description: 'Number of active trading pairs' })
  activeSymbols: number;

  @ApiProperty({ description: 'Overview timestamp' })
  timestamp: number;
}
