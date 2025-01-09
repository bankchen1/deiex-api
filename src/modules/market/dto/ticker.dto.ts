import { ApiProperty } from '@nestjs/swagger';

export class TickerDto {
  @ApiProperty({ description: '交易对符号' })
  symbol: string;

  @ApiProperty({ description: '最新价格' })
  price: string;

  @ApiProperty({ description: '24小时价格变化' })
  priceChange: string;

  @ApiProperty({ description: '24小时价格变化百分比' })
  priceChangePercent: string;

  @ApiProperty({ description: '24小时成交量' })
  volume: string;

  @ApiProperty({ description: '24小时成交额' })
  quoteVolume: string;

  @ApiProperty({ description: '24小时最高价' })
  high: string;

  @ApiProperty({ description: '24小时最低价' })
  low: string;

  @ApiProperty({ description: '24小时开盘价' })
  openPrice: string;

  @ApiProperty({ description: '时间戳' })
  timestamp: number;
}
