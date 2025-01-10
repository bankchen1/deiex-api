import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderSide } from '../trade/types/trade.types';

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  async checkOrderRisk(
    userId: string,
    symbol: string,
    side: OrderSide,
    amount: string,
    leverage: number,
    price: string,
  ): Promise<boolean> {
    // Check user's total position value
    const positions = await this.prisma.position.findMany({
      where: { userId },
    });

    const totalPositionValue = positions.reduce((sum, position) => {
      return sum + parseFloat(position.quantity) * parseFloat(position.entryPrice);
    }, 0);

    const newPositionValue = parseFloat(amount) * parseFloat(price);
    const maxPositionValue = 1000000; // $1M limit

    if (totalPositionValue + newPositionValue > maxPositionValue) {
      throw new BadRequestException('Position value exceeds limit');
    }

    // Check leverage limit
    const maxLeverage = 100;
    if (leverage > maxLeverage) {
      throw new BadRequestException('Leverage exceeds limit');
    }

    // Check concentration risk
    const symbolPositions = positions.filter(p => p.symbol === symbol);
    const symbolPositionValue = symbolPositions.reduce((sum, position) => {
      return sum + parseFloat(position.quantity) * parseFloat(position.entryPrice);
    }, 0);

    const maxSymbolValue = maxPositionValue * 0.2; // 20% of total limit
    if (symbolPositionValue + newPositionValue > maxSymbolValue) {
      throw new BadRequestException('Symbol position value exceeds limit');
    }

    return true;
  }

  async checkLiquidationRisk(positionId: string): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new BadRequestException('Position not found');
    }

    const liquidationPrice = parseFloat(position.liquidationPrice);
    const currentPrice = parseFloat(position.entryPrice); // TODO: Get market price

    if (position.side === OrderSide.BUY && currentPrice <= liquidationPrice) {
      await this.liquidatePosition(position);
    } else if (position.side === OrderSide.SELL && currentPrice >= liquidationPrice) {
      await this.liquidatePosition(position);
    }
  }

  private async liquidatePosition(position: any): Promise<void> {
    await this.prisma.position.update({
      where: { id: position.id },
      data: {
        quantity: '0',
        margin: '0',
        unrealizedPnl: '0',
        realizedPnl: (parseFloat(position.realizedPnl) - parseFloat(position.margin)).toString(),
      },
    });
  }
}
