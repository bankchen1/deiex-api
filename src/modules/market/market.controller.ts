import { 
  Controller, 
  Get, 
  Query, 
  Param, 
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
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
  @ApiOperation({ summary: '获取市场概览' })
  @ApiResponse({ status: 200, description: '获取成功', type: MarketOverviewDto })
  async getMarketOverview(): Promise<MarketOverviewDto> {
    return this.marketService.getMarketOverview();
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: '获取市场状态' })
  @ApiResponse({ status: 200, description: '获取成功', type: MarketStatusDto })
  async getMarketStatus(): Promise<MarketStatusDto> {
    return this.marketService.getMarketStatus();
  }

  @Public()
  @Get('ticker/price/:symbol')
  @ApiOperation({ summary: '获取指定交易对的最新价格' })
  @ApiParam({ name: 'symbol', description: '交易对', example: 'BTC-USDT' })
  @ApiResponse({ status: 200, description: '获取成功', type: TickerDto })
  async getTickerPrice(@Param('symbol') symbol: string): Promise<TickerDto> {
    const price = await this.marketService.getLatestPrice(symbol);
    return { symbol, price: price.toString() };
  }

  @Public()
  @Get('tickers')
  @ApiOperation({ summary: '获取所有交易对的最新价格' })
  @ApiResponse({ status: 200, description: '获取成功', type: [TickerDto] })
  async getAllTickers(): Promise<TickerDto[]> {
    const symbols = await this.marketService.getSymbols();
    const tickers = await Promise.all(
      symbols.map(async (symbol) => {
        const price = await this.marketService.getLatestPrice(symbol);
        return { symbol, price: price.toString() };
      })
    );
    return tickers;
  }

  @Public()
  @Get('ticker/book/:symbol')
  @ApiOperation({ summary: '获取指定交易对的最优挂单' })
  @ApiParam({ name: 'symbol', description: '交易对', example: 'BTC-USDT' })
  @ApiResponse({ status: 200, description: '获取成功', type: BookTickerDto })
  async getBookTicker(@Param('symbol') symbol: string): Promise<BookTickerDto> {
    const orderBook = await this.marketService.getOrderBook(symbol, { limit: 1 });
    return {
      symbol,
      bidPrice: orderBook.bids[0]?.[0] || '0',
      bidQty: orderBook.bids[0]?.[1] || '0',
      askPrice: orderBook.asks[0]?.[0] || '0',
      askQty: orderBook.asks[0]?.[1] || '0',
    };
  }

  @Public()
  @Get('depth/:symbol')
  @ApiOperation({ summary: '获取指定交易对的深度信息' })
  @ApiParam({ name: 'symbol', description: '交易对', example: 'BTC-USDT' })
  @ApiQuery({ name: 'limit', description: '深度档数', required: false, type: Number })
  @ApiResponse({ status: 200, description: '获取成功', type: OrderBookDto })
  async getOrderBook(
    @Param('symbol') symbol: string,
    @Query() query: OrderBookQueryDto,
  ): Promise<OrderBookDto> {
    return this.marketService.getOrderBook(symbol, query);
  }

  @Public()
  @Get('klines/:symbol')
  @ApiOperation({ summary: '获取K线数据' })
  @ApiParam({ name: 'symbol', description: '交易对', example: 'BTC-USDT' })
  @ApiQuery({ name: 'interval', description: 'K线间隔', enum: KlineInterval })
  @ApiQuery({ name: 'limit', description: '获取数量', required: false, type: Number })
  @ApiResponse({ status: 200, description: '获取成功', type: [KlineDto] })
  async getKlineData(
    @Param('symbol') symbol: string,
    @Query() query: KlineQueryDto,
  ): Promise<KlineDto[]> {
    return this.marketService.getKlines(symbol, query.interval, query.limit || 100);
  }

  @Public()
  @Get('trades/:symbol')
  @ApiOperation({ summary: '获取最近成交记录' })
  @ApiParam({ name: 'symbol', description: '交易对', example: 'BTC-USDT' })
  @ApiQuery({ name: 'limit', description: '获取数量', required: false, type: Number })
  @ApiResponse({ status: 200, description: '获取成功', type: [RecentTradeDto] })
  async getRecentTrades(
    @Param('symbol') symbol: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<RecentTradeDto[]> {
    if (limit > 1000) {
      throw new BadRequestException('Limit cannot exceed 1000');
    }
    return this.marketService.getRecentTrades(symbol, limit);
  }

  @Public()
  @Get('ticker/:symbol')
  @ApiOperation({ summary: 'Get ticker information for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading pair symbol', example: 'BTC-USDT' })
  async getTicker(@Param('symbol') symbol: string): Promise<TickerDto> {
    return this.marketService.getTicker(symbol);
  }

  @Public()
  @Get('tickers')
  @ApiOperation({ summary: 'Get all tickers' })
  async getTickers(): Promise<TickerDto[]> {
    return this.marketService.getTickers();
  }

  @Public()
  @Get('kline/:symbol')
  @ApiOperation({ summary: 'Get kline data for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading pair symbol', example: 'BTC-USDT' })
  @ApiQuery({ name: 'interval', description: 'Kline interval', example: '1m', required: true })
  @ApiQuery({ name: 'limit', description: 'Number of klines to return', example: 100, required: false })
  async getKline(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string,
    @Query('limit') limit?: number,
  ): Promise<KlineDto[]> {
    return this.marketService.getKline(symbol, interval, limit);
  }

  @Public()
  @Get('depth/:symbol')
  @ApiOperation({ summary: 'Get order book depth for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading pair symbol', example: 'BTC-USDT' })
  @ApiQuery({ name: 'limit', description: 'Depth limit', example: 100, required: false })
  async getDepth(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: number,
  ) {
    return this.marketService.getDepth(symbol, limit);
  }

  @Public()
  @Get('trades/:symbol')
  @ApiOperation({ summary: 'Get recent trades for a symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading pair symbol', example: 'BTC-USDT' })
  @ApiQuery({ name: 'limit', description: 'Number of trades to return', example: 100, required: false })
  async getTrades(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: number,
  ) {
    return this.marketService.getTrades(symbol, limit);
  }
}