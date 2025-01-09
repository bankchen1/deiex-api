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
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CopyTradingService } from '../services/copy-trading.service';
import {
  CreateCopyTradingDto,
  UpdateCopyTradingDto,
  CopyTradingDto,
  CopyTradingStatsDto,
  TraderRankingDto,
} from '../dto/copy-trading.dto';
import { User } from '../../auth/decorators/user.decorator';

@ApiTags('Copy Trading')
@Controller('copy-trading')
@UseGuards(JwtAuthGuard)
export class CopyTradingController {
  constructor(private readonly copyTradingService: CopyTradingService) {}

  @Post('trader')
  @ApiOperation({ summary: '注册成为交易者' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CopyTradingDto })
  async createTrader(
    @User('id') userId: string,
    @Body() createDto: CreateCopyTradingDto,
  ) {
    try {
      return await this.copyTradingService.createCopyTrader(userId, createDto);
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('follow/:traderId')
  @ApiOperation({ summary: '跟随交易者' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CopyTradingDto })
  async followTrader(
    @User('id') userId: string,
    @Param('traderId') traderId: string,
    @Body() copyTradingDto: CopyTradingDto,
  ) {
    try {
      return await this.copyTradingService.followTrader(
        userId,
        traderId,
        copyTradingDto,
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('unfollow/:copyTradeId')
  @ApiOperation({ summary: '取消跟随交易者' })
  @ApiResponse({ status: HttpStatus.OK })
  async unfollowTrader(
    @User('id') userId: string,
    @Param('copyTradeId') copyTradeId: string,
  ) {
    try {
      await this.copyTradingService.unfollowTrader(userId, copyTradeId);
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('settings/:copyTradeId')
  @ApiOperation({ summary: '更新复制交易设置' })
  @ApiResponse({ status: HttpStatus.OK, type: CopyTradingDto })
  async updateSettings(
    @User('id') userId: string,
    @Param('copyTradeId') copyTradeId: string,
    @Body() updateDto: UpdateCopyTradingDto,
  ) {
    try {
      return await this.copyTradingService.updateCopyTradeSettings(
        userId,
        copyTradeId,
        updateDto,
      );
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('trader/:traderId/stats')
  @ApiOperation({ summary: '获取交易者统计数据' })
  @ApiResponse({ status: HttpStatus.OK, type: CopyTradingStatsDto })
  async getTraderStats(@Param('traderId') traderId: string) {
    try {
      return await this.copyTradingService.getTraderStats(traderId);
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('risk/:copyTradeId')
  @ApiOperation({ summary: '获取复制交易风险指标' })
  @ApiResponse({ status: HttpStatus.OK })
  async getRiskMetrics(@Param('copyTradeId') copyTradeId: string) {
    try {
      return await this.copyTradingService.getRiskMetrics(copyTradeId);
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rankings')
  @ApiOperation({ summary: '获取交易者排行榜' })
  @ApiResponse({ status: HttpStatus.OK, type: [TraderRankingDto] })
  async getTraderRankings(
    @Query('category') category: string,
    @Query('limit') limit: number = 10,
  ) {
    try {
      // TODO: Implement trader rankings
      return [];
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('my/following')
  @ApiOperation({ summary: '获取我的跟随列表' })
  @ApiResponse({ status: HttpStatus.OK, type: [CopyTradingDto] })
  async getMyFollowing(@User('id') userId: string) {
    try {
      // TODO: Implement get my following list
      return [];
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('my/followers')
  @ApiOperation({ summary: '获取我的跟随者列表' })
  @ApiResponse({ status: HttpStatus.OK, type: [CopyTradingDto] })
  async getMyFollowers(@User('id') userId: string) {
    try {
      // TODO: Implement get my followers list
      return [];
    } catch (error) {
      throw new HttpException(
        error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
