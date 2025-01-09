import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CopyTradingService } from './copy-trading.service';
import {
  CreateCopyTradingDto,
  UpdateCopyTradingDto,
  CopyTradingDto,
  CopyTradingHistoryDto,
  TraderRankingDto,
} from './dto/copy-trading.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';

@ApiTags('Copy Trading')
@Controller('copy-trading')
@UseGuards(JwtAuthGuard)
export class CopyTradingController {
  constructor(private readonly copyTradingService: CopyTradingService) {}

  @Post('follow')
  @ApiOperation({ summary: 'Follow a trader' })
  @ApiResponse({ status: 201, type: CopyTradingDto })
  async followTrader(
    @User('id') followerId: string,
    @Body() dto: CreateCopyTradingDto,
  ): Promise<CopyTradingDto> {
    return this.copyTradingService.followTrader(followerId, dto);
  }

  @Delete('unfollow/:traderId')
  @ApiOperation({ summary: 'Unfollow a trader' })
  async unfollowTrader(
    @User('id') followerId: string,
    @Param('traderId') traderId: string,
  ): Promise<void> {
    return this.copyTradingService.unfollowTrader(followerId, traderId);
  }

  @Put('settings/:traderId')
  @ApiOperation({ summary: 'Update copy trading settings' })
  @ApiResponse({ status: 200, type: CopyTradingDto })
  async updateCopySettings(
    @User('id') followerId: string,
    @Param('traderId') traderId: string,
    @Body() dto: UpdateCopyTradingDto,
  ): Promise<CopyTradingDto> {
    return this.copyTradingService.updateCopySettings(followerId, traderId, dto);
  }

  @Put('pause/:traderId')
  @ApiOperation({ summary: 'Pause copy trading' })
  async pauseCopying(
    @User('id') followerId: string,
    @Param('traderId') traderId: string,
  ): Promise<void> {
    return this.copyTradingService.pauseCopying(followerId, traderId);
  }

  @Put('resume/:traderId')
  @ApiOperation({ summary: 'Resume copy trading' })
  async resumeCopying(
    @User('id') followerId: string,
    @Param('traderId') traderId: string,
  ): Promise<void> {
    return this.copyTradingService.resumeCopying(followerId, traderId);
  }

  @Get('followers/:traderId')
  @ApiOperation({ summary: 'Get followers of a trader' })
  @ApiResponse({ status: 200, type: [CopyTradingDto] })
  async getFollowers(
    @Param('traderId') traderId: string,
  ): Promise<CopyTradingDto[]> {
    return this.copyTradingService.getFollowers(traderId);
  }

  @Get('following')
  @ApiOperation({ summary: 'Get traders being followed' })
  @ApiResponse({ status: 200, type: [CopyTradingDto] })
  async getFollowing(
    @User('id') followerId: string,
  ): Promise<CopyTradingDto[]> {
    return this.copyTradingService.getFollowing(followerId);
  }

  @Get('stats/:traderId')
  @ApiOperation({ summary: 'Get copy trading statistics' })
  async getCopyTradingStats(
    @User('id') followerId: string,
    @Param('traderId') traderId: string,
  ) {
    return this.copyTradingService.getCopyTradingStats(followerId, traderId);
  }

  @Get('history/:traderId')
  @ApiOperation({ summary: 'Get copy trading history' })
  @ApiResponse({ status: 200, type: [CopyTradingHistoryDto] })
  async getCopyTradingHistory(
    @User('id') followerId: string,
    @Param('traderId') traderId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<CopyTradingHistoryDto[]> {
    return this.copyTradingService.getCopyTradingHistory(
      followerId,
      traderId,
      page,
      limit,
    );
  }

  @Get('ranking')
  @ApiOperation({ summary: 'Get trader rankings' })
  @ApiResponse({ status: 200, type: [TraderRankingDto] })
  async getTraderRanking(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<TraderRankingDto[]> {
    return this.copyTradingService.getTraderRanking(page, limit);
  }

  @Get('performance/:traderId')
  @ApiOperation({ summary: 'Get trader performance' })
  async getTraderPerformance(@Param('traderId') traderId: string) {
    return this.copyTradingService.getTraderPerformance(traderId);
  }
}
