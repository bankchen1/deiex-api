import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCopyTradingDto } from './dto/create-copy-trading.dto';
import { UpdateCopyTradingDto } from './dto/update-copy-trading.dto';
import { CopyTradingDto } from './dto/copy-trading.dto';
import { CopyTradingHistoryDto } from './dto/copy-trading-history.dto';
import { TraderRankingDto } from './dto/trader-ranking.dto';

@Injectable()
export class CopyTradingService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(followerId: string, traderId: string): Promise<CopyTradingDto> {
    const copyTrading = await this.prisma.copyTrading.findUnique({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    if (!copyTrading) {
      throw new NotFoundException('Copy trading relationship not found');
    }

    return {
      ...copyTrading,
      traderUsername: copyTrading.trader.username,
    };
  }

  async create(followerId: string, dto: CreateCopyTradingDto): Promise<CopyTradingDto> {
    const copyTrading = await this.prisma.copyTrading.create({
      data: {
        followerId,
        traderId: dto.traderId,
        status: 'ACTIVE',
        leverage: dto.leverage,
        maxAmount: dto.maxAmount,
        copyPercentage: dto.copyPercentage,
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    return {
      ...copyTrading,
      traderUsername: copyTrading.trader.username,
    };
  }

  async findByFollowerId(followerId: string): Promise<CopyTradingDto[]> {
    const copyTradings = await this.prisma.copyTrading.findMany({
      where: {
        followerId,
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    return copyTradings.map((ct) => ({
      ...ct,
      traderUsername: ct.trader.username,
    }));
  }

  async update(followerId: string, traderId: string, dto: UpdateCopyTradingDto): Promise<CopyTradingDto> {
    const copyTrading = await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        status: dto.status,
        leverage: dto.leverage,
        maxAmount: dto.maxAmount,
        copyPercentage: dto.copyPercentage,
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    return {
      ...copyTrading,
      traderUsername: copyTrading.trader.username,
    };
  }

  async delete(followerId: string, traderId: string): Promise<void> {
    await this.prisma.copyTrading.delete({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
    });
  }

  async pause(followerId: string, traderId: string): Promise<CopyTradingDto> {
    const copyTrading = await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        status: 'PAUSED',
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    return {
      ...copyTrading,
      traderUsername: copyTrading.trader.username,
    };
  }

  async resume(followerId: string, traderId: string): Promise<CopyTradingDto> {
    const copyTrading = await this.prisma.copyTrading.update({
      where: {
        followerId_traderId: {
          followerId,
          traderId,
        },
      },
      data: {
        status: 'ACTIVE',
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    return {
      ...copyTrading,
      traderUsername: copyTrading.trader.username,
    };
  }

  async getFollowerStats(followerId: string) {
    const history = await this.prisma.copyTradingHistory.findMany({
      where: {
        copyTrading: {
          followerId,
        },
      },
    });

    const successfulTrades = history.filter(
      (trade) => trade.status === 'SUCCESS' && trade.profit > 0,
    ).length;
    const totalProfit = history.reduce((sum, trade) => sum + Number(trade.profit), 0);

    return {
      totalTrades: history.length,
      successfulTrades,
      winRate: history.length > 0 ? (successfulTrades / history.length) * 100 : 0,
      totalProfit,
    };
  }

  async getFollowerHistory(
    followerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: CopyTradingHistoryDto[]; total: number }> {
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      this.prisma.copyTradingHistory.findMany({
        where: {
          copyTrading: {
            followerId,
          },
        },
        orderBy: {
          copyTime: 'desc',
        },
        skip,
        take: limit,
        include: {
          copyTrading: {
            include: {
              trader: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.copyTradingHistory.count({
        where: {
          copyTrading: {
            followerId,
          },
        },
      }),
    ]);

    const data = history.map((h) => ({
      id: h.id,
      traderId: h.copyTrading.traderId,
      traderUsername: h.copyTrading.trader.username,
      type: h.type,
      status: h.status,
      symbol: h.symbol,
      amount: h.amount,
      profit: h.profit,
      copyTime: h.copyTime,
      createdAt: h.createdAt,
    }));

    return { data, total };
  }

  async getTopTraders(
    limit: number,
  ): Promise<TraderRankingDto[]> {
    const rankings = await this.prisma.traderStats.findMany({
      take: limit,
      orderBy: {
        totalProfit: 'desc',
      },
      include: {
        trader: {
          select: {
            username: true,
          },
        },
      },
    });

    return rankings.map((rank) => ({
      traderId: rank.traderId,
      username: rank.trader.username,
      totalProfit: Number(rank.totalProfit),
      winRate: Number(rank.winRate),
      followers: rank.followers,
      totalTrades: rank.totalTrades,
    }));
  }

  async getTraderHistory(
    traderId: string,
    limit: number,
  ): Promise<CopyTradingHistoryDto[]> {
    const history = await this.prisma.copyTradingHistory.findMany({
      where: {
        copyTrading: {
          traderId,
        },
      },
      orderBy: {
        copyTime: 'desc',
      },
      take: limit,
      include: {
        copyTrading: {
          include: {
            trader: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    return history.map((h) => ({
      id: h.id,
      traderId: h.copyTrading.traderId,
      traderUsername: h.copyTrading.trader.username,
      type: h.type,
      status: h.status,
      symbol: h.symbol,
      amount: h.amount,
      profit: h.profit,
      copyTime: h.copyTime,
      createdAt: h.createdAt,
    }));
  }
}
