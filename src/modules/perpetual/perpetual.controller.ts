import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { PerpetualService } from './perpetual.service';
import {
  CreateOrderDto,
  OrderDto,
  PositionDto,
  UpdateLeverageDto,
  FundingRateDto,
  TradeHistoryDto,
} from './dto/perpetual.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@ApiTags('Perpetual')
@Controller('perpetual')
@UseGuards(JwtAuthGuard)
export class PerpetualController {
  constructor(private readonly perpetualService: PerpetualService) {}

  @Post('order')
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, type: OrderDto })
  async createOrder(
    @User('id') userId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderDto> {
    return this.perpetualService.createOrder(userId, dto);
  }

  @Delete('order/:orderId')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiResponse({ status: 200, type: OrderDto })
  async cancelOrder(
    @User('id') userId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderDto> {
    return this.perpetualService.cancelOrder(userId, orderId);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, type: OrderDto })
  async getOrder(
    @User('id') userId: string,
    @Param('orderId') orderId: string,
  ): Promise<OrderDto> {
    return this.perpetualService.getOrder(userId, orderId);
  }

  @Get('open-orders')
  @ApiOperation({ summary: 'Get open orders' })
  @ApiResponse({ status: 200, type: [OrderDto] })
  @ApiQuery({ name: 'symbol', required: false })
  async getOpenOrders(
    @User('id') userId: string,
    @Query('symbol') symbol?: string,
  ): Promise<OrderDto[]> {
    return this.perpetualService.getOpenOrders(userId, symbol);
  }

  @Get('order-history')
  @ApiOperation({ summary: 'Get order history' })
  @ApiResponse({ status: 200, type: [OrderDto] })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getOrderHistory(
    @User('id') userId: string,
    @Query('symbol') symbol?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<OrderDto[]> {
    return this.perpetualService.getOrderHistory(userId, symbol, page, limit);
  }

  @Get('position/:symbol')
  @ApiOperation({ summary: 'Get position for a symbol' })
  @ApiResponse({ status: 200, type: PositionDto })
  async getPosition(
    @User('id') userId: string,
    @Param('symbol') symbol: string,
  ): Promise<PositionDto | null> {
    return this.perpetualService.getPosition(userId, symbol);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get all positions' })
  @ApiResponse({ status: 200, type: [PositionDto] })
  async getPositions(@User('id') userId: string): Promise<PositionDto[]> {
    return this.perpetualService.getPositions(userId);
  }

  @Post('position/close/:symbol')
  @ApiOperation({ summary: 'Close position for a symbol' })
  @ApiResponse({ status: 200, type: OrderDto })
  async closePosition(
    @User('id') userId: string,
    @Param('symbol') symbol: string,
  ): Promise<OrderDto> {
    return this.perpetualService.closePosition(userId, symbol);
  }

  @Put('leverage')
  @ApiOperation({ summary: 'Update leverage' })
  async updateLeverage(
    @User('id') userId: string,
    @Body() dto: UpdateLeverageDto,
  ): Promise<void> {
    return this.perpetualService.updateLeverage(userId, dto);
  }

  @Get('funding-rate/:symbol')
  @ApiOperation({ summary: 'Get funding rate' })
  @ApiResponse({ status: 200, type: FundingRateDto })
  async getFundingRate(
    @Param('symbol') symbol: string,
  ): Promise<FundingRateDto> {
    return this.perpetualService.getFundingRate(symbol);
  }

  @Get('trade-history')
  @ApiOperation({ summary: 'Get trade history' })
  @ApiResponse({ status: 200, type: [TradeHistoryDto] })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTradeHistory(
    @User('id') userId: string,
    @Query('symbol') symbol?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<TradeHistoryDto[]> {
    return this.perpetualService.getTradeHistory(userId, symbol, page, limit);
  }
}
