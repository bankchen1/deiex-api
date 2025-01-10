import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { PrometheusService } from '../../modules/prometheus/prometheus.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { CreateDepositDto, CreateWithdrawDto, TransactionQueryDto } from './dto/asset.dto';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prometheus: PrometheusService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getUserBalance(userId: string, currency: string) {
    return (this.prisma as any).asset.findUnique({
      where: {
        userId_currency: {
          userId,
          currency,
        },
      },
    });
  }

  async getUserBalances(userId: string) {
    return (this.prisma as any).asset.findMany({
      where: {
        userId,
      },
    });
  }

  async createDeposit(userId: string, dto: CreateDepositDto) {
    const { currency, amount, address, chain } = dto;

    const transaction = await this.prisma.$transaction(async (prisma) => {
      // 创建或更新用户资产
      const asset = await (prisma as any).asset.upsert({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
        create: {
          userId,
          currency,
          available: amount,
          locked: '0',
        },
        update: {
          available: {
            increment: amount,
          },
        },
      });

      // 创建存款记录
      const transaction = await (prisma as any).transaction.create({
        data: {
          userId,
          currency,
          type: 'DEPOSIT',
          amount,
          status: 'PENDING',
          address,
          chain,
        },
      });

      return transaction;
    });

    // 更新 Prometheus 指标
    this.prometheus.incrementDeposit(currency, amount);

    return transaction;
  }

  async createWithdraw(userId: string, dto: CreateWithdrawDto) {
    const { currency, amount, address, chain, fee } = dto;

    const transaction = await this.prisma.$transaction(async (prisma) => {
      // 检查用户余额是否足够
      const asset = await (prisma as any).asset.findUnique({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
      });

      if (!asset || new Prisma.Decimal(asset.available).lessThan(amount)) {
        throw new Error('Insufficient balance');
      }

      // 更新用户资产
      await (prisma as any).asset.update({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
        data: {
          available: {
            decrement: amount,
          },
          locked: {
            increment: amount,
          },
        },
      });

      // 创建提现记录
      const transaction = await (prisma as any).transaction.create({
        data: {
          userId,
          currency,
          type: 'WITHDRAW',
          amount,
          fee,
          status: 'PENDING',
          address,
          chain,
        },
      });

      return transaction;
    });

    // 更新 Prometheus 指标
    this.prometheus.incrementWithdraw(currency, amount);

    return transaction;
  }

  async getTransactions(userId: string, query: TransactionQueryDto) {
    const { currency, type, status, limit = 100, offset = 0 } = query;

    return (this.prisma as any).transaction.findMany({
      where: {
        userId,
        ...(currency && { currency }),
        ...(type && { type }),
        ...(status && { status }),
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
