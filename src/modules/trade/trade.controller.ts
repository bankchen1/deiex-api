import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TradeService } from './trade.service';
import {
  CreateOrderDto,
  OrderResponseDto,
  TradeResponseDto,
  TradeQueryDto,
  TradeHistoryDto,
  TradeStatisticsDto,
  OrderBookResponseDto,
} from './dto/trade.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('trades')
@Controller('trades')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Post('orders')
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid order parameters or insufficient balance',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createOrder(
    @Req() req,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.tradeService.createOrder(req.user.id, createOrderDto);
  }

  @Delete('orders/:orderId')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiParam({ name: 'orderId', description: 'Order ID to cancel' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be cancelled',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async cancelOrder(
    @Req() req,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.tradeService.cancelOrder(req.user.id, orderId);
  }

  @Get('orderbook/:symbol')
  @ApiOperation({ summary: 'Get order book for symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading pair symbol (e.g., BTC-USDT)' })
  @ApiQuery({
    name: 'limit',
    description: 'Number of price levels to return',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns order book with bids and asks',
    type: OrderBookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid symbol',
  })
  async getOrderBook(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: number,
  ): Promise<OrderBookResponseDto> {
    return this.tradeService.getOrderBook(symbol, limit);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get user orders' })
  @ApiQuery({
    name: 'symbol',
    description: 'Filter by trading pair symbol',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns user orders',
    type: [OrderResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserOrders(
    @Req() req,
    @Query('symbol') symbol?: string,
  ): Promise<OrderResponseDto[]> {
    return this.tradeService.getUserOrders(req.user.id, symbol);
  }

  @Get(':tradeId')
  @ApiOperation({ summary: 'Get trade details' })
  @ApiParam({ name: 'tradeId', description: 'Trade ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns trade details',
    type: TradeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Trade not found',
  })
  async getTradeDetail(
    @Req() req,
    @Param('tradeId') tradeId: string,
  ): Promise<TradeResponseDto> {
    return this.tradeService.getTradeDetail(req.user.id, tradeId);
  }

  @Post(':tradeId/close')
  @ApiOperation({ summary: 'Close a trade' })
  @ApiParam({ name: 'tradeId', description: 'Trade ID to close' })
  @ApiResponse({
    status: 200,
    description: 'Trade closed successfully',
    type: TradeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Trade cannot be closed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Trade not found',
  })
  async closeTrade(
    @Req() req,
    @Param('tradeId') tradeId: string,
  ): Promise<TradeResponseDto> {
    return this.tradeService.closeTrade(req.user.id, tradeId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user trade history' })
  @ApiQuery({
    name: 'symbol',
    description: 'Filter by trading pair symbol',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'orderId',
    description: 'Filter by order ID',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'startTime',
    description: 'Start time in ISO format',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'endTime',
    description: 'End time in ISO format',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of trades to return (default: 50, max: 1000)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns user trade history',
    type: TradeHistoryDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserTrades(
    @Req() req,
    @Query() query: TradeQueryDto,
  ): Promise<TradeHistoryDto> {
    return this.tradeService.getUserTrades(req.user.id, query);
  }

  @Get('statistics/:symbol')
  @ApiOperation({ summary: 'Get trade statistics for symbol' })
  @ApiParam({ name: 'symbol', description: 'Trading pair symbol (e.g., BTC-USDT)' })
  @ApiResponse({
    status: 200,
    description: 'Returns trade statistics including price, volume, high, low, and change',
    type: TradeStatisticsDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid symbol',
  })
  async getTradeStatistics(
    @Param('symbol') symbol: string,
  ): Promise<TradeStatisticsDto> {
    return this.tradeService.getTradeStatistics(symbol);
  }
}
