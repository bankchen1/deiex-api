import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatisticsService } from './services/statistics.service';
import {
  StatisticsQueryDto,
  TradingMetricsResponse,
  WinRateResponse,
  TimeFrame,
} from './dto/statistics.dto';

@ApiTags('Statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('metrics')
  @ApiOperation({ summary: '获取交易统计指标' })
  @ApiQuery({ name: 'symbol', required: false, description: '交易对' })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiQuery({ 
    name: 'timeFrame', 
    enum: TimeFrame, 
    required: false, 
    description: '时间周期' 
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: TradingMetricsResponse,
  })
  async getTradingMetrics(
    @Request() req,
    @Query() query: StatisticsQueryDto,
  ): Promise<TradingMetricsResponse> {
    return await this.statisticsService.getTradingMetrics(req.user.id, query);
  }

  @Get('win-rate')
  @ApiOperation({ summary: '获取交易胜率' })
  @ApiQuery({ name: 'symbol', required: false, description: '交易对' })
  @ApiQuery({ name: 'startTime', required: false, description: '开始时间' })
  @ApiQuery({ name: 'endTime', required: false, description: '结束时间' })
  @ApiQuery({ 
    name: 'timeFrame', 
    enum: TimeFrame, 
    required: false, 
    description: '时间周期' 
  })
  @ApiResponse({
    status: 200,
    description: '获取成功',
    type: WinRateResponse,
  })
  async getWinRate(
    @Request() req,
    @Query() query: StatisticsQueryDto,
  ): Promise<WinRateResponse> {
    return await this.statisticsService.getWinRate(req.user.id, query);
  }
}
