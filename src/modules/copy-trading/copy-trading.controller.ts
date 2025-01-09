import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Get,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CopyTradingService } from './copy-trading.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FollowTraderDto,
  CopyTradeSettingsDto,
  CopyTradingStatsDto,
  CopyTradingHistoryDto,
  TraderRankingDto,
} from './dto/copy-trading.dto';

@ApiTags('复制交易')
@Controller('copy-trading')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CopyTradingController {
  constructor(private readonly copyTradingService: CopyTradingService) {}

  @Post('follow')
  @ApiOperation({ summary: '关注交易者' })
  @ApiResponse({ status: 201, description: '关注成功' })
  async followTrader(
    @Request() req,
    @Body() dto: FollowTraderDto,
  ): Promise<void> {
    return this.copyTradingService.followTrader(req.user.id, dto);
  }

  @Post('unfollow/:traderId')
  @ApiOperation({ summary: '取消关注交易者' })
  @ApiResponse({ status: 200, description: '取消关注成功' })
  async unfollowTrader(
    @Request() req,
    @Param('traderId') traderId: string,
  ): Promise<void> {
    return this.copyTradingService.unfollowTrader(req.user.id, traderId);
  }

  @Put('settings/:traderId')
  @ApiOperation({ summary: '更新复制交易设置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateSettings(
    @Request() req,
    @Param('traderId') traderId: string,
    @Body() dto: CopyTradeSettingsDto,
  ): Promise<void> {
    return this.copyTradingService.updateCopySettings(req.user.id, traderId, dto);
  }

  @Post('pause/:traderId')
  @ApiOperation({ summary: '暂停复制交易' })
  @ApiResponse({ status: 200, description: '暂停成功' })
  async pauseCopying(
    @Request() req,
    @Param('traderId') traderId: string,
  ): Promise<void> {
    return this.copyTradingService.pauseCopying(req.user.id, traderId);
  }

  @Post('resume/:traderId')
  @ApiOperation({ summary: '恢复复制交易' })
  @ApiResponse({ status: 200, description: '恢复成功' })
  async resumeCopying(
    @Request() req,
    @Param('traderId') traderId: string,
  ): Promise<void> {
    return this.copyTradingService.resumeCopying(req.user.id, traderId);
  }

  @Get('followers')
  @ApiOperation({ summary: '获取关注者列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFollowers(@Request() req): Promise<any[]> {
    return this.copyTradingService.getFollowers(req.user.id);
  }

  @Get('following')
  @ApiOperation({ summary: '获取正在关注的交易者列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFollowing(@Request() req): Promise<any[]> {
    return this.copyTradingService.getFollowing(req.user.id);
  }

  @Get('stats/:traderId')
  @ApiOperation({ summary: '获取复制交易统计' })
  @ApiResponse({ status: 200, description: '获取成功', type: CopyTradingStatsDto })
  async getCopyTradingStats(
    @Request() req,
    @Param('traderId') traderId: string,
  ): Promise<CopyTradingStatsDto> {
    return this.copyTradingService.getCopyTradingStats(req.user.id, traderId);
  }

  @Get('history/:traderId')
  @ApiOperation({ summary: '获取复制交易历史' })
  @ApiResponse({ status: 200, description: '获取成功', type: [CopyTradingHistoryDto] })
  async getCopyTradingHistory(
    @Request() req,
    @Param('traderId') traderId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<{ data: CopyTradingHistoryDto[]; total: number }> {
    return this.copyTradingService.getCopyTradingHistory(req.user.id, traderId, page, limit);
  }

  @Get('ranking')
  @ApiOperation({ summary: '获取交易者排行榜' })
  @ApiResponse({ status: 200, description: '获取成功', type: [TraderRankingDto] })
  async getTraderRanking(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<{ data: TraderRankingDto[]; total: number }> {
    return this.copyTradingService.getTraderRanking(page, limit);
  }

  @Get('performance/:traderId')
  @ApiOperation({ summary: '获取交易者绩效详情' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTraderPerformance(
    @Param('traderId') traderId: string,
  ): Promise<any> {
    return this.copyTradingService.getTraderPerformance(traderId);
  }
}
