import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TradeAnalysisService } from './trade-analysis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  TradeAnalysisQueryDto,
  TradeStatistics,
  TradePerformance,
  DailyPerformance,
} from './dto/trade-analysis.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Trade Analysis')
@Controller('trade-analysis')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradeAnalysisController {
  constructor(private readonly tradeAnalysisService: TradeAnalysisService) {}

  @Get('statistics')
  @ApiOperation({ summary: 'Get trade statistics' })
  async getTradeStatistics(
    @Request() req,
    @Query() query: TradeAnalysisQueryDto,
  ): Promise<TradeStatistics> {
    return this.tradeAnalysisService.getTradeStatistics(req.user.id, query);
  }

  @Get('symbol-performance')
  @ApiOperation({ summary: 'Get performance by symbol' })
  async getSymbolPerformance(
    @Request() req,
    @Query() query: TradeAnalysisQueryDto,
  ): Promise<TradePerformance[]> {
    return this.tradeAnalysisService.getSymbolPerformance(req.user.id, query);
  }

  @Get('daily-performance')
  @ApiOperation({ summary: 'Get daily performance' })
  async getDailyPerformance(
    @Request() req,
    @Query() query: TradeAnalysisQueryDto,
  ): Promise<DailyPerformance[]> {
    return this.tradeAnalysisService.getDailyPerformance(req.user.id, query);
  }
}
