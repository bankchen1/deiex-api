import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TradeService } from '../trade/trade.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  FollowTraderDto,
  CopyTradeSettingsDto,
  CopyTradingStatus,
  CopyTradingStatsDto,
  CopyTradingHistoryDto,
  TraderRankingDto,
} from './dto/copy-trading.dto';

@Injectable()
export class CopyTradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tradeService: TradeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async followTrader(followerId: string, dto: FollowTraderDto): Promise<void> {
    // 检查是否已经关注
    const existingFollow = await this.prisma.copyTrading.findUnique({
      where: {
        followerId_traderId: {
          followerId,
          traderId: dto.traderId,
        },
      },
    });

    if (existingFollow) {
      throw new BadRequestException('已经关注了该交易者');
    }

    // 检查交易者是否存在
    const trader = await this.prisma.user.findUnique({
      where: { id: dto.traderId },
    });

    if (!trader) {
      throw new BadRequestException('交易者不存在');
    }

    // 创建跟随关系
    await this.prisma.copyTrading.create({
      data: {
        followerId,
        traderId: dto.traderId,
        status: CopyTradingStatus.ACTIVE,
        copyPercentage: dto.copyPercentage,
        maxPositions: dto.maxPositions,
        maxLossPercentage: dto.maxLossPercentage,
      },
    });

    // 更新交易者统计
    await this.updateTraderStats(dto.traderId);

    // 发送事件
    this.eventEmitter.emit('copyTrading.followed', {
      followerId,
      traderId: dto.traderId,
    });
  }

  async unfollowTrader(followerId: string, traderId: string): Promise<void> {
    const follow = await this.prisma.copyTrading.findUnique({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
    });

    if (!follow) {
      throw new BadRequestException('未关注该交易者');
    }

    await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        status: CopyTradingStatus.INACTIVE,
      },
    });

    // 更新交易者统计
    await this.updateTraderStats(traderId);

    // 发送事件
    this.eventEmitter.emit('copyTrading.unfollowed', {
      followerId,
      traderId,
    });
  }

  async updateCopySettings(
    followerId: string,
    traderId: string,
    dto: CopyTradeSettingsDto,
  ): Promise<void> {
    const follow = await this.prisma.copyTrading.findUnique({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
    });

    if (!follow) {
      throw new BadRequestException('未关注该交易者');
    }

    await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        copyPercentage: dto.copyPercentage,
        maxPositions: dto.maxPositions,
        maxLossPercentage: dto.maxLossPercentage,
      },
    });
  }

  async pauseCopying(followerId: string, traderId: string): Promise<void> {
    await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        status: CopyTradingStatus.PAUSED,
      },
    });
  }

  async resumeCopying(followerId: string, traderId: string): Promise<void> {
    await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        status: CopyTradingStatus.ACTIVE,
      },
    });
  }

  async getFollowers(traderId: string): Promise<any[]> {
    return this.prisma.copyTrading.findMany({
      where: {
        traderId,
        status: CopyTradingStatus.ACTIVE,
      },
      include: {
        follower: true,
      },
    });
  }

  async getFollowing(followerId: string): Promise<any[]> {
    return this.prisma.copyTrading.findMany({
      where: {
        followerId,
        status: CopyTradingStatus.ACTIVE,
      },
      include: {
        trader: true,
      },
    });
  }

  async getCopyTradingStats(
    followerId: string,
    traderId: string,
  ): Promise<CopyTradingStatsDto> {
    const history = await this.prisma.copyTradingHistory.findMany({
      where: {
        followerId,
        traderId,
      },
    });

    const totalTrades = history.length;
    const successfulTrades = history.filter(
      (trade) => trade.status === 'SUCCESS' && trade.profit > 0,
    ).length;
    const totalProfit = history.reduce((sum, trade) => sum + Number(trade.profit), 0);

    return {
      totalProfit,
      winRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
      totalTrades,
      successfulTrades,
      averageProfit: totalTrades > 0 ? totalProfit / totalTrades : 0,
      followersCount: await this.getFollowersCount(traderId),
    };
  }

  async getCopyTradingHistory(
    followerId: string,
    traderId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: CopyTradingHistoryDto[]; total: number }> {
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      this.prisma.copyTradingHistory.findMany({
        where: {
          followerId,
          traderId,
        },
        orderBy: {
          copyTime: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.copyTradingHistory.count({
        where: {
          followerId,
          traderId,
        },
      }),
    ]);

    return {
      data: history,
      total,
    };
  }

  async getTraderRanking(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: TraderRankingDto[]; total: number }> {
    const skip = (page - 1) * limit;

    const [rankings, total] = await Promise.all([
      this.prisma.traderStats.findMany({
        orderBy: {
          totalProfit: 'desc',
        },
        skip,
        take: limit,
        include: {
          trader: {
            select: {
              username: true,
            },
          },
        },
      }),
      this.prisma.traderStats.count(),
    ]);

    return {
      data: rankings.map((rank, index) => ({
        traderId: rank.traderId,
        username: rank.trader.username,
        totalProfit: Number(rank.totalProfit),
        winRate: Number(rank.winRate),
        followersCount: rank.followersCount,
        ranking: skip + index + 1,
      })),
      total,
    };
  }

  async getTraderPerformance(traderId: string): Promise<any> {
    const trader = await this.prisma.user.findUnique({
      where: { id: traderId },
    });

    if (!trader) {
      throw new NotFoundException('交易者不存在');
    }

    const stats = await this.prisma.traderStats.findUnique({
      where: { traderId },
    });

    const history = await this.prisma.copyTradingHistory.findMany({
      where: { traderId },
      orderBy: { copyTime: 'desc' },
      take: 30, // 最近30笔交易
    });

    return {
      trader: {
        id: trader.id,
        username: trader.username,
      },
      stats,
      recentTrades: history,
    };
  }

  private async updateTraderStats(traderId: string): Promise<void> {
    const [followers, history] = await Promise.all([
      this.getFollowersCount(traderId),
      this.prisma.copyTradingHistory.findMany({
        where: { traderId },
      }),
    ]);

    const totalTrades = history.length;
    const successfulTrades = history.filter(
      (trade) => trade.status === 'SUCCESS' && trade.profit > 0,
    ).length;
    const totalProfit = history.reduce((sum, trade) => sum + Number(trade.profit), 0);

    await this.prisma.traderStats.upsert({
      where: { traderId },
      update: {
        totalProfit,
        winRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
        totalTrades,
        successfulTrades,
        followersCount: followers,
      },
      create: {
        traderId,
        totalProfit,
        winRate: totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0,
        totalTrades,
        successfulTrades,
        followersCount: followers,
        ranking: 0, // 将在定时任务中更新
      },
    });
  }

  private async getFollowersCount(traderId: string): Promise<number> {
    return this.prisma.copyTrading.count({
      where: {
        traderId,
        status: CopyTradingStatus.ACTIVE,
      },
    });
  }

  async copyTrade(trade: any): Promise<void> {
    const followers = await this.prisma.copyTrading.findMany({
      where: {
        traderId: trade.userId,
        status: CopyTradingStatus.ACTIVE,
      },
    });

    for (const follower of followers) {
      try {
        // 检查最大持仓数量
        if (follower.maxPositions) {
          const openPositions = await this.prisma.position.count({
            where: {
              userId: follower.followerId,
              status: 'OPEN',
            },
          });

          if (openPositions >= follower.maxPositions) {
            continue;
          }
        }

        // 检查最大亏损百分比
        if (follower.maxLossPercentage) {
          const totalLoss = await this.calculateTotalLoss(follower.followerId);
          if (totalLoss >= follower.maxLossPercentage) {
            continue;
          }
        }

        // 计算复制数量
        const copyAmount = (trade.amount * Number(follower.copyPercentage)) / 100;

        // 创建复制订单
        const copyTrade = await this.tradeService.createOrder({
          userId: follower.followerId,
          symbol: trade.symbol,
          side: trade.side,
          type: trade.type,
          amount: copyAmount,
          price: trade.price,
          leverage: trade.leverage,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
        });

        // 记录复制交易历史
        await this.prisma.copyTradingHistory.create({
          data: {
            followerId: follower.followerId,
            traderId: trade.userId,
            symbol: trade.symbol,
            amount: copyAmount,
            price: trade.price,
            profit: 0, // 初始利润为0，将在交易完成后更新
            status: 'SUCCESS',
          },
        });

        // 发送事件
        this.eventEmitter.emit('copyTrading.tradeCopied', {
          followerId: follower.followerId,
          traderId: trade.userId,
          tradeId: trade.id,
          copyTradeId: copyTrade.id,
        });
      } catch (error) {
        // 记录失败的复制交易
        await this.prisma.copyTradingHistory.create({
          data: {
            followerId: follower.followerId,
            traderId: trade.userId,
            symbol: trade.symbol,
            amount: 0,
            price: trade.price,
            profit: 0,
            status: 'FAILED',
            errorReason: error.message,
          },
        });

        console.error(
          `Failed to copy trade for follower ${follower.followerId}:`,
          error,
        );
      }
    }
  }

  private async calculateTotalLoss(userId: string): Promise<number> {
    const positions = await this.prisma.position.findMany({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    return positions.reduce((total, position) => {
      if (position.unrealizedPnl < 0) {
        return total + Math.abs(Number(position.unrealizedPnl));
      }
      return total;
    }, 0);
  }
}
