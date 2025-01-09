import { 
  Controller, 
  Get, 
  Query, 
  Param, 
  UseGuards,
  CacheInterceptor,
  UseInterceptors,
  ValidationPipe,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { Public } from '../auth/decorators/public.decorator';
import { 
  TickerDto, 
  OrderBookDto, 
  KlineDto, 
  MarketOverviewDto,
  KlineQueryDto,
  OrderBookQueryDto,
  TradesQueryDto,
  KlineInterval,
  MarketStatusDto,
  BookTickerDto,
  RecentTradeDto,
} from './dto/market.dto';

@ApiTags('Market')
@Controller('market')
@UseInterceptors(CacheInterceptor)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Public()
  @Get('overview')
  @ApiOperation({ summary: 'Get market overview' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns market overview information',
    type: MarketOverviewDto 
  })
  async getMarketOverview(): Promise<MarketOverviewDto> {
    return this.marketService.getMarketOverview();
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Get market status' })
  @ApiResponse({
    status: 200,
    description: 'Returns market status information',
    type: MarketStatusDto
  })
  async getMarketStatus(): Promise<MarketStatusDto> {
    return this.marketService.getMarketStatus();
  }

  @Public()
  @Get('ticker/:symbol')
  @ApiOperation({ summary: 'Get ticker information for a specific symbol' })
  @ApiParam({ name: 'symbol', description: 'Market symbol (e.g., BTC-USDT)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns ticker information',
    type: TickerDto 
  })
  async getTicker(@Param('symbol') symbol: string): Promise<TickerDto> {
    return this.marketService.getTickerPrice(symbol);
  }

  @Public()
  @Get('tickers')
  @ApiOperation({ summary: 'Get all tickers' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns all tickers information',
    type: [TickerDto] 
  })
  async getAllTickers(): Promise<TickerDto[]> {
    return this.marketService.getAllTickers();
  }

  @Public()
  @Get('bookTicker/:symbol')
  @ApiOperation({ summary: 'Get best bid/ask for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Market symbol (e.g., BTC-USDT)' })
  @ApiResponse({
    status: 200,
    description: 'Returns best bid/ask prices and quantities',
    type: BookTickerDto
  })
  async getBookTicker(@Param('symbol') symbol: string): Promise<BookTickerDto> {
    const orderBook = await this.marketService.getOrderBook(symbol, { limit: 1 });
    return {
      symbol,
      bidPrice: orderBook.bids[0]?.price || '0',
      bidQty: orderBook.bids[0]?.quantity || '0',
      askPrice: orderBook.asks[0]?.price || '0',
      askQty: orderBook.asks[0]?.quantity || '0',
    };
  }

  @Public()
  @Get('orderbook/:symbol')
  @ApiOperation({ summary: 'Get order book for a specific symbol' })
  @ApiParam({ name: 'symbol', description: 'Market symbol (e.g., BTC-USDT)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of orders to return' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns order book information',
    type: OrderBookDto 
  })
  async getOrderBook(
    @Param('symbol') symbol: string,
    @Query(ValidationPipe) query: OrderBookQueryDto,
  ): Promise<OrderBookDto> {
    return this.marketService.getOrderBook(symbol, query);
  }

  @Public()
  @Get('klines/:symbol')
  @ApiOperation({ summary: 'Get kline/candlestick data for a specific symbol' })
  @ApiParam({ name: 'symbol', description: 'Market symbol (e.g., BTC-USDT)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns kline/candlestick data',
    type: [KlineDto] 
  })
  async getKlines(
    @Param('symbol') symbol: string,
    @Query(ValidationPipe) query: KlineQueryDto,
  ): Promise<KlineDto[]> {
    if (!Object.values(KlineInterval).includes(query.interval)) {
      throw new BadRequestException('Invalid kline interval');
    }
    return this.marketService.getKlineData(symbol, query);
  }

  @Public()
  @Get('trades/:symbol')
  @ApiOperation({ summary: 'Get recent trades for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Market symbol (e.g., BTC-USDT)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of trades to return' })
  @ApiResponse({
    status: 200,
    description: 'Returns recent trades',
    type: [RecentTradeDto]
  })
  async getRecentTrades(
    @Param('symbol') symbol: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<RecentTradeDto[]> {
    return this.marketService.getRecentTrades(symbol, limit);
  }
}