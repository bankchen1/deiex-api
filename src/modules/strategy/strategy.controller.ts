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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { StrategyService } from './strategy.service';
import { StrategyFactory, StrategyType } from './strategy.factory';
import { BaseStrategyParameters } from './types/strategy-parameters.type';

@ApiTags('策略')
@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategyController {
  constructor(
    private readonly strategyService: StrategyService,
    private readonly strategyFactory: StrategyFactory,
  ) {}

  @Post()
  @ApiOperation({ summary: '创建策略' })
  @ApiResponse({ status: 201, description: '策略创建成功' })
  async createStrategy(
    @Body('type') type: StrategyType,
    @Body('parameters') parameters: BaseStrategyParameters,
  ) {
    return this.strategyService.createStrategy(type, parameters);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新策略' })
  @ApiResponse({ status: 200, description: '策略更新成功' })
  async updateStrategy(
    @Param('id') id: string,
    @Body('type') type: StrategyType,
    @Body('parameters') parameters: BaseStrategyParameters,
  ) {
    return this.strategyService.updateStrategy(id, type, parameters);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除策略' })
  @ApiResponse({ status: 200, description: '策略删除成功' })
  async deleteStrategy(@Param('id') id: string) {
    return this.strategyService.deleteStrategy(id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取策略详情' })
  @ApiResponse({ status: 200, description: '获取策略成功' })
  async getStrategy(@Param('id') id: string) {
    return this.strategyService.getStrategy(id);
  }

  @Get()
  @ApiOperation({ summary: '获取所有策略' })
  @ApiResponse({ status: 200, description: '获取策略列表成功' })
  async getAllStrategies() {
    return this.strategyService.getAllStrategies();
  }

  @Post(':id/execute')
  @ApiOperation({ summary: '执行策略' })
  @ApiResponse({ status: 200, description: '策略执行成功' })
  async executeStrategy(@Param('id') id: string) {
    return this.strategyService.executeStrategy(id);
  }

  @Get('types')
  @ApiOperation({ summary: '获取所有策略类型' })
  @ApiResponse({ status: 200, description: '获取策略类型列表成功' })
  async getStrategyTypes() {
    return this.strategyFactory.getStrategyTypes();
  }

  @Get('types/:type/parameters')
  @ApiOperation({ summary: '获取策略类型的默认参数' })
  @ApiResponse({ status: 200, description: '获取默认参数成功' })
  async getDefaultParameters(@Param('type') type: StrategyType) {
    return this.strategyFactory.getDefaultParameters(type);
  }
} 