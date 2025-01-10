import { Controller, Get, Query } from '@nestjs/common';
import { MarketService } from './market.service';
import {
  MarketOverviewDto,
  TickerDto,
  OrderBookDto,
  OrderBookQueryDto,
  KlineDto,
  KlineQueryDto,
  RecentTradeDto,
} from './dto/market.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('overview')
  async getOverview(): Promise<MarketOverviewDto> {
    return this.marketService.getOverview();
  }

  @Get('tickers')
  async getTickers(): Promise<TickerDto[]> {
    return this.marketService.getTickers();
  }

  @Get('ticker')
  async getTicker(@Query('symbol') symbol: string): Promise<TickerDto> {
    return this.marketService.getTicker(symbol);
  }

  @Get('orderbook')
  async getOrderBook(@Query() query: OrderBookQueryDto): Promise<OrderBookDto> {
    return this.marketService.getOrderBook(query.symbol, query.limit);
  }

  @Get('klines')
  async getKlines(@Query() query: KlineQueryDto): Promise<KlineDto[]> {
    return this.marketService.getKlines(query.symbol, query.interval, query.limit);
  }

  @Get('trades')
  async getRecentTrades(
    @Query('symbol') symbol: string,
    @Query('limit') limit?: number,
  ): Promise<RecentTradeDto[]> {
    return this.marketService.getRecentTrades(symbol, limit);
  }
}