import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketDataDto } from './dto/market-data.dto';
import { OrderBookDto } from './dto/order-book.dto';
import { TradeHistoryDto } from './dto/trade-history.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get(':symbol/market-data')
  async getMarketData(@Param('symbol') symbol: string): Promise<MarketDataDto> {
    return this.marketService.getMarketData(symbol);
  }

  @Get(':symbol/order-book')
  async getOrderBook(@Param('symbol') symbol: string): Promise<OrderBookDto> {
    return this.marketService.getOrderBook(symbol);
  }

  @Get(':symbol/trade-history')
  async getTradeHistory(@Param('symbol') symbol: string): Promise<TradeHistoryDto> {
    return this.marketService.getTradeHistory(symbol);
  }
}