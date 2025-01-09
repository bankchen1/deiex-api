import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { StrategyService } from './strategy.service';
import {
  CreateStrategyDto,
  UpdateStrategyDto,
  StrategyPerformanceDto,
  BacktestDto,
  StrategySubscriptionDto,
} from './dto/strategy.dto';

@ApiTags('Strategy')
@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategyController {
  constructor(
    private readonly strategyService: StrategyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new strategy' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CreateStrategyDto })
  async createStrategy(
    @User('id') userId: string,
    @Body() dto: CreateStrategyDto,
  ) {
    return this.strategyService.create(userId, dto);
  }

  @Put(':strategyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a strategy' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.OK, type: UpdateStrategyDto })
  async updateStrategy(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
    @Body() dto: UpdateStrategyDto,
  ) {
    return this.strategyService.update(userId, strategyId, dto);
  }

  @Delete(':strategyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a strategy' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async deleteStrategy(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
  ) {
    await this.strategyService.delete(userId, strategyId);
  }

  @Get(':strategyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get strategy details' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.OK, type: CreateStrategyDto })
  async getStrategy(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
  ) {
    return this.strategyService.findOne(userId, strategyId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all strategies' })
  @ApiResponse({ status: HttpStatus.OK, type: [CreateStrategyDto] })
  async getAllStrategies(@User('id') userId: string) {
    return this.strategyService.findAll(userId);
  }

  @Get(':strategyId/performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get strategy performance' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.OK, type: StrategyPerformanceDto })
  async getPerformance(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
  ) {
    return this.strategyService.getPerformance(userId, strategyId);
  }

  @Post(':strategyId/backtest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run strategy backtest' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async runBacktest(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
    @Body() dto: BacktestDto,
  ) {
    return this.strategyService.runBacktest(userId, strategyId, dto);
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to a strategy' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async subscribe(
    @User('id') userId: string,
    @Body() dto: StrategySubscriptionDto,
  ) {
    return this.strategyService.subscribe(userId, dto);
  }

  @Delete('subscribe/:strategyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from a strategy' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async unsubscribe(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
  ) {
    await this.strategyService.unsubscribe(userId, strategyId);
  }

  @Get('subscriptions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get user subscriptions' })
  @ApiResponse({ status: HttpStatus.OK })
  async getSubscriptions(@User('id') userId: string) {
    return this.strategyService.getSubscriptions(userId);
  }

  @Get(':strategyId/subscribers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get strategy subscribers' })
  @ApiParam({ name: 'strategyId', description: 'Strategy ID' })
  @ApiResponse({ status: HttpStatus.OK })
  async getSubscribers(
    @User('id') userId: string,
    @Param('strategyId') strategyId: string,
  ) {
    return this.strategyService.getSubscribers(userId, strategyId);
  }
}