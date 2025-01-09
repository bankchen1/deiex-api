import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import {
  CopyTradingDto,
  CreateCopyTradingDto,
  UpdateCopyTradingDto,
  CopyTradingHistoryDto,
  TraderRankingDto,
} from './dto/copy-trading.dto';

@Injectable()
export class CopyTradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async followTrader(followerId: string, dto: CreateCopyTradingDto): Promise<CopyTradingDto> {
    const existingFollow = await this.prisma.copyTrading.findFirst({
      where: {
        followerId,
        traderId: dto.traderId,
      },
    });

    if (existingFollow) {
      throw new Error('Already following this trader');
    }

    const copyTrading = await this.prisma.copyTrading.create({
      data: {
        followerId,
        traderId: dto.traderId,
        copyRatio: dto.copyRatio,
        maxCopyAmount: dto.maxCopyAmount,
        minCopyAmount: dto.minCopyAmount,
        isActive: true,
      },
    });

    return copyTrading;
  }

  async unfollowTrader(followerId: string, traderId: string): Promise<void> {
    const copyTrading = await this.prisma.copyTrading.findFirst({
      where: {
        followerId,
        traderId,
      },
    });

    if (!copyTrading) {
      throw new NotFoundException('Copy trading relationship not found');
    }

    await this.prisma.copyTrading.delete({
      where: {
        id: copyTrading.id,
      },
    });
  }

  async updateCopySettings(
    followerId: string,
    traderId: string,
    dto: UpdateCopyTradingDto,
  ): Promise<CopyTradingDto> {
    const copyTrading = await this.prisma.copyTrading.findFirst({
      where: {
        followerId,
        traderId,
      },
    });

    if (!copyTrading) {
      throw new NotFoundException('Copy trading relationship not found');
    }

    return await this.prisma.copyTrading.update({
      where: {
        id: copyTrading.id,
      },
      data: {
        copyRatio: dto.copyRatio,
        maxCopyAmount: dto.maxCopyAmount,
        minCopyAmount: dto.minCopyAmount,
      },
    });
  }

  async pauseCopying(followerId: string, traderId: string): Promise<void> {
    const copyTrading = await this.prisma.copyTrading.findFirst({
      where: {
        followerId,
        traderId,
      },
    });

    if (!copyTrading) {
      throw new NotFoundException('Copy trading relationship not found');
    }

    await this.prisma.copyTrading.update({
      where: {
        id: copyTrading.id,
      },
      data: {
        isActive: false,
      },
    });
  }

  async resumeCopying(followerId: string, traderId: string): Promise<void> {
    const copyTrading = await this.prisma.copyTrading.findFirst({
      where: {
        followerId,
        traderId,
      },
    });

    if (!copyTrading) {
      throw new NotFoundException('Copy trading relationship not found');
    }

    await this.prisma.copyTrading.update({
      where: {
        id: copyTrading.id,
      },
      data: {
        isActive: true,
      },
    });
  }

  async getFollowers(traderId: string): Promise<CopyTradingDto[]> {
    return await this.prisma.copyTrading.findMany({
      where: {
        traderId,
      },
    });
  }

  async getFollowing(followerId: string): Promise<CopyTradingDto[]> {
    return await this.prisma.copyTrading.findMany({
      where: {
        followerId,
      },
    });
  }

  async getCopyTradingStats(followerId: string, traderId: string) {
    const copyTrading = await this.prisma.copyTrading.findFirst({
      where: {
        followerId,
        traderId,
      },
      include: {
        trades: true,
      },
    });

    if (!copyTrading) {
      throw new NotFoundException('Copy trading relationship not found');
    }

    // Calculate statistics
    const trades = copyTrading.trades;
    const profitableTrades = trades.filter(t => parseFloat(t.realizedPnl) > 0);
    const totalPnl = trades.reduce((sum, t) => sum + parseFloat(t.realizedPnl), 0);
    const winRate = trades.length > 0 ? (profitableTrades.length / trades.length) * 100 : 0;

    return {
      totalTrades: trades.length,
      profitableTrades: profitableTrades.length,
      totalPnl: totalPnl.toFixed(8),
      winRate: winRate.toFixed(2),
      averagePnl: trades.length > 0 ? (totalPnl / trades.length).toFixed(8) : '0',
    };
  }

  async getCopyTradingHistory(
    followerId: string,
    traderId: string,
    page = 1,
    limit = 100,
  ): Promise<CopyTradingHistoryDto[]> {
    const trades = await this.prisma.copyTradingHistory.findMany({
      where: {
        followerId,
        traderId,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return trades.map(trade => ({
      id: trade.id,
      followerId: trade.followerId,
      traderId: trade.traderId,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity.toString(),
      price: trade.price.toString(),
      realizedPnl: trade.realizedPnl.toString(),
      commission: trade.commission.toString(),
      createdAt: trade.createdAt,
    }));
  }

  async getTraderRanking(page = 1, limit = 100): Promise<TraderRankingDto[]> {
    const rankings = await this.prisma.traderRanking.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        rank: 'asc',
      },
    });

    return rankings;
  }

  async getTraderPerformance(traderId: string) {
    const trader = await this.prisma.user.findUnique({
      where: {
        id: traderId,
      },
      include: {
        traderStats: true,
      },
    });

    if (!trader) {
      throw new NotFoundException('Trader not found');
    }

    return trader.traderStats;
  }
}
