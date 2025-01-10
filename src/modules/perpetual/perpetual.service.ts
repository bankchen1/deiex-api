import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisClientService } from '../redis/redis.service';
import { MarketService } from '../market/market.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PerpetualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisClientService,
    private readonly marketService: MarketService,
  ) {}

  async getPositions(userId: string) {
    return this.prisma.position.findMany({
      where: { userId },
      include: { user: true },
    });
  }

  async getPosition(userId: string, symbol: string) {
    return this.prisma.position.findFirst({
      where: { userId, symbol },
      include: { user: true },
    });
  }

  async updateLiquidationPrices() {
    const positions = await this.prisma.position.findMany({
      include: { user: true },
    });

    for (const position of positions) {
      const marketData = await this.marketService.getMarketData(position.symbol);
      const currentPrice = marketData.price;

      // 计算清算价格
      const liquidationPrice = this.calculateLiquidationPrice(
        position.side,
        position.entryPrice,
        position.leverage,
        position.margin,
        position.quantity,
      );

      // 如果当前价格触及清算价格，执行清算
      if (this.shouldLiquidate(position.side, currentPrice, liquidationPrice)) {
        await this.liquidatePosition(position.id);
      }
    }
  }

  private calculateLiquidationPrice(
    side: string,
    entryPrice: string,
    leverage: number,
    margin: string,
    quantity: string,
  ): number {
    const positionValue = parseFloat(entryPrice) * parseFloat(quantity);
    const maintenanceMargin = positionValue * 0.005; // 0.5% 维持保证金率
    
    if (side === 'LONG') {
      return parseFloat(entryPrice) * (1 - (parseFloat(margin) - maintenanceMargin) / positionValue);
    } else {
      return parseFloat(entryPrice) * (1 + (parseFloat(margin) - maintenanceMargin) / positionValue);
    }
  }

  private shouldLiquidate(side: string, currentPrice: number, liquidationPrice: number): boolean {
    if (side === 'LONG') {
      return currentPrice <= liquidationPrice;
    } else {
      return currentPrice >= liquidationPrice;
    }
  }

  private async liquidatePosition(positionId: string) {
    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        quantity: '0',
        entryPrice: '0',
        liquidationPrice: '0',
        margin: '0',
        unrealizedPnl: '0',
      },
    });
  }
}
