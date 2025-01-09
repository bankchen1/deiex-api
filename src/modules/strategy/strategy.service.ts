import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketService } from '../market/market.service';
import { StrategyFactory, StrategyType } from './strategy.factory';
import { BaseStrategyParameters } from './types/strategy-parameters.type';
import { BaseStrategy } from './templates/base-strategy';
import { Kline } from './types/kline.type';

@Injectable()
export class StrategyService {
  private activeStrategies: Map<string, BaseStrategy> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
    private readonly strategyFactory: StrategyFactory,
  ) {}

  async createStrategy(
    type: StrategyType,
    parameters: BaseStrategyParameters,
  ): Promise<BaseStrategy> {
    // 验证参数
    this.strategyFactory.validateParameters(type, parameters);

    // 创建策略实例
    const strategy = this.strategyFactory.createStrategy(type, parameters);

    // 保存策略到数据库
    await this.prisma.strategy.create({
      data: {
        name: parameters.name,
        description: parameters.description,
        type,
        symbol: parameters.symbol,
        interval: parameters.interval,
        parameters: parameters as any,
        isActive: true,
      },
    });

    // 将策略添加到活动策略列表
    this.activeStrategies.set(parameters.name, strategy);

    return strategy;
  }

  async updateStrategy(
    id: string,
    type: StrategyType,
    parameters: BaseStrategyParameters,
  ): Promise<BaseStrategy> {
    // 验证参数
    this.strategyFactory.validateParameters(type, parameters);

    // 检查策略是否存在
    const existingStrategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!existingStrategy) {
      throw new Error('策略不存在');
    }

    // 创建新的策略实例
    const strategy = this.strategyFactory.createStrategy(type, parameters);

    // 更新数据库中的策略
    await this.prisma.strategy.update({
      where: { id },
      data: {
        name: parameters.name,
        description: parameters.description,
        type,
        symbol: parameters.symbol,
        interval: parameters.interval,
        parameters: parameters as any,
      },
    });

    // 更新活动策略列表
    this.activeStrategies.set(parameters.name, strategy);

    return strategy;
  }

  async deleteStrategy(id: string): Promise<void> {
    // 检查策略是否存在
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new Error('策略不存在');
    }

    // 从活动策略列表中移除
    this.activeStrategies.delete(strategy.name);

    // 从数据库中删除
    await this.prisma.strategy.delete({
      where: { id },
    });
  }

  async getStrategy(id: string): Promise<BaseStrategy> {
    // 从数据库中获取策略
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new Error('策略不存在');
    }

    // 如果策略已经在活动列表中，直接返回
    if (this.activeStrategies.has(strategy.name)) {
      return this.activeStrategies.get(strategy.name)!;
    }

    // 创建新的策略实例
    const newStrategy = this.strategyFactory.createStrategy(
      strategy.type as StrategyType,
      strategy.parameters as BaseStrategyParameters,
    );

    // 添加到活动策略列表
    this.activeStrategies.set(strategy.name, newStrategy);

    return newStrategy;
  }

  async getAllStrategies(): Promise<BaseStrategy[]> {
    // 从数据库中获取所有策略
    const strategies = await this.prisma.strategy.findMany();

    // 将所有策略转换为策略实例
    return strategies.map((strategy) => {
      // 如果策略已经在活动列表中，直接返回
      if (this.activeStrategies.has(strategy.name)) {
        return this.activeStrategies.get(strategy.name)!;
      }

      // 创建新的策略实例
      const newStrategy = this.strategyFactory.createStrategy(
        strategy.type as StrategyType,
        strategy.parameters as BaseStrategyParameters,
      );

      // 添加到活动策略列表
      this.activeStrategies.set(strategy.name, newStrategy);

      return newStrategy;
    });
  }

  async executeStrategy(id: string): Promise<void> {
    // 获取策略实例
    const strategy = await this.getStrategy(id);

    // 获取策略参数
    const dbStrategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!dbStrategy) {
      throw new Error('策略不存在');
    }

    const parameters = dbStrategy.parameters as BaseStrategyParameters;

    // 获取历史K线数据
    const historicalKlines = await this.marketService.getKlines(
      parameters.symbol,
      parameters.interval,
      100, // 获取足够的历史数据用于计算指标
    );

    // 获取当前K线数据
    const currentKline = historicalKlines[historicalKlines.length - 1];

    // 生成交易信号
    const signal = await strategy.generateSignal(
      currentKline as Kline,
      historicalKlines as Kline[],
    );

    if (signal) {
      // 获取当前持仓
      const position = await this.prisma.position.findFirst({
        where: {
          strategyId: id,
          status: 'OPEN',
        },
      });

      if (position) {
        // 检查是否应该平仓
        const shouldExit = await strategy.shouldExit(currentKline as Kline, {
          side: position.side,
          entryPrice: Number(position.entryPrice),
          stopLoss: position.stopLoss ? Number(position.stopLoss) : undefined,
          takeProfit: position.takeProfit ? Number(position.takeProfit) : undefined,
        });

        if (shouldExit) {
          // 执行平仓操作
          await this.closePosition(position.id, Number(currentKline.close));
        }
      } else {
        // 计算仓位大小
        const equity = await this.getAvailableEquity(parameters.symbol);
        const size = await strategy.calculatePositionSize(equity, signal.price);

        // 开新仓位
        await this.openPosition(id, signal, size);
      }
    }
  }

  private async getAvailableEquity(symbol: string): Promise<number> {
    // 获取账户余额
    const balance = await this.prisma.balance.findFirst({
      where: {
        asset: symbol.split('/')[1], // 获取计价货币
      },
    });

    if (!balance) {
      throw new Error('没有可用余额');
    }

    return Number(balance.free);
  }

  private async openPosition(
    strategyId: string,
    signal: {
      side: 'BUY' | 'SELL';
      type: 'MARKET' | 'LIMIT';
      price: number;
      stopLoss?: number;
      takeProfit?: number;
    },
    size: number,
  ): Promise<void> {
    // 创建新的仓位记录
    await this.prisma.position.create({
      data: {
        strategyId,
        side: signal.side,
        type: signal.type,
        size: size,
        entryPrice: signal.price,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        status: 'OPEN',
      },
    });
  }

  private async closePosition(positionId: string, exitPrice: number): Promise<void> {
    // 更新仓位状态
    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        exitPrice,
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }
} 