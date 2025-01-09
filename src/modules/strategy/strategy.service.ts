import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import {
  CreateStrategyDto,
  UpdateStrategyDto,
  StrategyStatus,
  StrategyPerformanceDto,
  BacktestDto,
  StrategySubscriptionDto,
} from './dto/strategy.dto';

@Injectable()
export class StrategyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async create(userId: string, dto: CreateStrategyDto) {
    return await this.prisma.strategy.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        symbol: dto.symbol,
        parameters: dto.parameters,
        status: StrategyStatus.INACTIVE,
      },
    });
  }

  async update(userId: string, strategyId: string, dto: UpdateStrategyDto) {
    const strategy = await this.prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId,
      },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    return await this.prisma.strategy.update({
      where: { id: strategyId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        parameters: dto.parameters,
      },
    });
  }

  async delete(userId: string, strategyId: string) {
    const strategy = await this.prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId,
      },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    if (strategy.status === StrategyStatus.ACTIVE) {
      throw new BadRequestException('Cannot delete active strategy');
    }

    await this.prisma.strategy.delete({
      where: { id: strategyId },
    });
  }

  async findOne(userId: string, strategyId: string) {
    const strategy = await this.prisma.strategy.findFirst({
      where: {
        id: strategyId,
        userId,
      },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    return strategy;
  }

  async findAll(userId: string) {
    return await this.prisma.strategy.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPerformance(userId: string, strategyId: string): Promise<StrategyPerformanceDto> {
    const strategy = await this.findOne(userId, strategyId);

    const trades = await this.prisma.strategyTrade.findMany({
      where: {
        strategyId,
      },
    });

    const followers = await this.prisma.strategySubscription.count({
      where: {
        strategyId,
      },
    });

    const runningDays = Math.ceil(
      (Date.now() - strategy.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const profits = trades.map(t => Number(t.profit));
    const totalReturn = profits.reduce((sum, p) => sum + p, 0);
    const winningTrades = trades.filter(t => Number(t.profit) > 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let balance = 0;
    for (const profit of profits) {
      balance += profit;
      if (balance > peak) {
        peak = balance;
      }
      const drawdown = ((peak - balance) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Calculate monthly return
    const monthlyTrades = trades.filter(
      t => t.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    const monthlyReturn = monthlyTrades.reduce((sum, t) => sum + Number(t.profit), 0);

    return {
      totalReturn,
      monthlyReturn,
      maxDrawdown,
      winRate,
      followers,
      runningDays,
    };
  }

  async runBacktest(userId: string, strategyId: string, dto: BacktestDto) {
    const strategy = await this.findOne(userId, strategyId);

    // TODO: Implement actual backtesting logic
    const backtestResult = {
      trades: [],
      performance: {
        totalReturn: 0,
        maxDrawdown: 0,
        winRate: 0,
        sharpeRatio: 0,
      },
    };

    await this.prisma.backtest.create({
      data: {
        strategyId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        initialCapital: dto.initialCapital,
        symbol: dto.symbol,
        parameters: dto.parameters,
        result: backtestResult,
      },
    });

    return backtestResult;
  }

  async subscribe(userId: string, dto: StrategySubscriptionDto) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id: dto.strategyId },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    if (strategy.userId === userId) {
      throw new BadRequestException('Cannot subscribe to your own strategy');
    }

    if (strategy.status !== StrategyStatus.ACTIVE) {
      throw new BadRequestException('Strategy is not active');
    }

    const existingSubscription = await this.prisma.strategySubscription.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId: dto.strategyId,
        },
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('Already subscribed to this strategy');
    }

    return await this.prisma.strategySubscription.create({
      data: {
        userId,
        strategyId: dto.strategyId,
        copyRatio: dto.copyRatio,
        maxLossPercentage: dto.maxLossPercentage,
      },
    });
  }

  async unsubscribe(userId: string, strategyId: string) {
    const subscription = await this.prisma.strategySubscription.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId,
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.strategySubscription.delete({
      where: {
        userId_strategyId: {
          userId,
          strategyId,
        },
      },
    });
  }

  async getSubscriptions(userId: string) {
    return await this.prisma.strategySubscription.findMany({
      where: {
        userId,
      },
      include: {
        strategy: true,
      },
    });
  }

  async getSubscribers(userId: string, strategyId: string) {
    const strategy = await this.findOne(userId, strategyId);

    return await this.prisma.strategySubscription.findMany({
      where: {
        strategyId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }
}