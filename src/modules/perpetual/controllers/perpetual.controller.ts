import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PerpetualService } from '../services/perpetual.service';
import { LiquidationService } from '../services/liquidation.service';
import { FundingService } from '../services/funding.service';
import { RiskControlService } from '../services/risk-control.service';
import {
  CreateOrderDto,
  AdjustLeverageDto,
  OrderQueryDto,
} from '../dto/perpetual.dto';
import {
  PerpetualOrder,
  Position,
  FundingInfo,
  LiquidationOrder,
  RiskMetrics,
} from '../types/perpetual.types';

@ApiTags('Perpetual')
@Controller('perpetual')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PerpetualController {
  constructor(
    private readonly perpetualService: PerpetualService,
    private readonly liquidationService: LiquidationService,
    private readonly fundingService: FundingService,
    private readonly riskControlService: RiskControlService,
  ) {}

  // 订单相关
  @Post('orders')
  @ApiOperation({ summary: '创建永续合约订单' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: '订单创建成功', type: PerpetualOrder })
  async createOrder(
    @Request() req,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<PerpetualOrder> {
    return await this.perpetualService.createOrder(req.user.id, createOrderDto);
  }

  @Delete('orders/:orderId')
  @ApiOperation({ summary: '取消永续合约订单' })
  @ApiParam({ name: 'orderId', description: '订单ID' })
  @ApiResponse({ status: 200, description: '订单取消成功', type: PerpetualOrder })
  async cancelOrder(
    @Request() req,
    @Param('orderId') orderId: string,
  ): Promise<PerpetualOrder> {
    return await this.perpetualService.cancelOrder(req.user.id, orderId);
  }

  @Get('orders')
  @ApiOperation({ summary: '获取永续合约订单列表' })
  @ApiQuery({ type: OrderQueryDto })
  @ApiResponse({ status: 200, description: '获取成功', type: [PerpetualOrder] })
  async getOrders(
    @Request() req,
    @Query() query: OrderQueryDto,
  ): Promise<PerpetualOrder[]> {
    return await this.perpetualService.getOpenOrders(req.user.id, query.symbol);
  }

  // 持仓相关
  @Get('positions')
  @ApiOperation({ summary: '获取永续合约持仓' })
  @ApiQuery({ name: 'symbol', required: false, description: '交易对' })
  @ApiResponse({ status: 200, description: '获取成功', type: [Position] })
  async getPositions(
    @Request() req,
    @Query('symbol') symbol?: string,
  ): Promise<Position[]> {
    return await this.perpetualService.getPositions(req.user.id, symbol);
  }

  @Put('positions/leverage')
  @ApiOperation({ summary: '调整持仓杠杆' })
  @ApiBody({ type: AdjustLeverageDto })
  @ApiResponse({ status: 200, description: '调整成功', type: Position })
  async adjustLeverage(
    @Request() req,
    @Body() dto: AdjustLeverageDto,
  ): Promise<Position> {
    return await this.perpetualService.adjustLeverage(
      req.user.id,
      dto.symbol,
      dto.leverage,
    );
  }

  // 资金费率
  @Get('funding/:symbol')
  @ApiOperation({ summary: '获取资金费率信息' })
  @ApiParam({ name: 'symbol', description: '交易对' })
  @ApiResponse({ status: 200, description: '获取成功', type: FundingInfo })
  async getFundingInfo(
    @Param('symbol') symbol: string,
  ): Promise<FundingInfo> {
    return await this.fundingService.getFundingInfo(symbol);
  }

  // 清算历史
  @Get('liquidation/history')
  @ApiOperation({ summary: '获取清算历史' })
  @ApiQuery({ name: 'symbol', required: false, description: '交易对' })
  @ApiQuery({ name: 'limit', required: false, description: '返回数量' })
  @ApiResponse({ status: 200, description: '获取成功', type: [LiquidationOrder] })
  async getLiquidationHistory(
    @Request() req,
    @Query('symbol') symbol?: string,
    @Query('limit') limit?: number,
  ): Promise<LiquidationOrder[]> {
    return await this.liquidationService.getLiquidationHistory(
      req.user.id,
      symbol,
      limit,
    );
  }

  // 风险指标
  @Get('risk/metrics')
  @ApiOperation({ summary: '获取用户风险指标' })
  @ApiQuery({ name: 'symbol', required: false, description: '交易对' })
  @ApiResponse({ status: 200, description: '获取成功', type: RiskMetrics })
  async getRiskMetrics(
    @Request() req,
    @Query('symbol') symbol?: string,
  ): Promise<RiskMetrics> {
    return await this.riskControlService.getUserRiskMetrics(req.user.id, symbol);
  }
}
