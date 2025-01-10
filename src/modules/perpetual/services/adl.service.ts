import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrometheusService } from '../../shared/prometheus/prometheus.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ADLService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prometheusService: PrometheusService,
    private readonly prisma: PrismaService,
  ) {}

  async getADLQueue(symbol: string, side: string): Promise<string[]> {
    const key = `adl:${symbol}:${side}`;
    return this.redis.lrange(key, 0, -1);
  }

  async addToADLQueue(symbol: string, side: string, userId: string) {
    const key = `adl:${symbol}:${side}`;
    await this.redis.rpush(key, userId);
  }

  async removeFromADLQueue(symbol: string, side: string, userId: string) {
    const key = `adl:${symbol}:${side}`;
    await this.redis.lrem(key, 0, userId);
  }

  async checkADLTrigger(symbol: string, side: string): Promise<boolean> {
    const insuranceFund = await this.getInsuranceFundBalance(symbol);
    const threshold = await this.getADLThreshold(symbol);
    return insuranceFund < threshold;
  }

  async executeADL(symbol: string, side: string) {
    const queue = await this.getADLQueue(symbol, side);
    if (queue.length === 0) {
      return;
    }

    const userId = queue[0];
    const position = await this.prisma.position.findUnique({
      where: {
        userId_symbol_side: {
          userId,
          symbol,
          side,
        },
      },
    });

    if (!position) {
      await this.removeFromADLQueue(symbol, side, userId);
      return;
    }

    // Close position at market price
    await this.closePosition(position);

    // Remove from ADL queue
    await this.removeFromADLQueue(symbol, side, userId);
  }

  private async closePosition(position: any) {
    // Implement position closing logic
    // This should create a market order to close the position
  }

  private async getInsuranceFundBalance(symbol: string): Promise<number> {
    const balance = await this.redis.get(`insurance:${symbol}`);
    return balance ? parseFloat(balance) : 0;
  }

  private async getADLThreshold(symbol: string): Promise<number> {
    const threshold = await this.redis.get(`adl_threshold:${symbol}`);
    return threshold ? parseFloat(threshold) : 1000000; // Default threshold
  }

  async updateADLRanking(symbol: string, side: string) {
    const positions = await this.prisma.position.findMany({
      where: {
        symbol,
        side,
      },
    });

    // Sort positions by profit ratio
    const sortedPositions = positions.sort((a, b) => {
      const profitRatioA = parseFloat(a.unrealizedPnl) / parseFloat(a.margin);
      const profitRatioB = parseFloat(b.unrealizedPnl) / parseFloat(b.margin);
      return profitRatioB - profitRatioA;
    });

    // Update ADL queue
    const key = `adl:${symbol}:${side}`;
    await this.redis.del(key);
    if (sortedPositions.length > 0) {
      await this.redis.rpush(
        key,
        ...sortedPositions.map((p) => p.userId)
      );
    }
  }
}
