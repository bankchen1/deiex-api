import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderSide } from '../trade/types/trade.types';
import { AssetService } from '../asset/asset.service';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly assetService: AssetService,
  ) {}

  async checkOrderRisk(
    userId: string,
    symbol: string,
    side: OrderSide,
    amount: number,
    leverage: number,
    price: number,
  ): Promise<boolean> {
    try {
      // 1. 检查交易对风险限制
      const riskControl = await this.prisma.riskControl.findUnique({
        where: { symbol },
      });

      if (!riskControl) {
        this.logger.warn(`No risk control found for symbol ${symbol}`);
        return true;
      }

      // 2. 检查用户风险限制
      const userRiskLimit = await this.prisma.userRiskLimit.findUnique({
        where: {
          userId_symbol: {
            userId,
            symbol,
          },
        },
      });

      // 3. 检查杠杆倍数
      const maxLeverage = userRiskLimit?.maxLeverage || riskControl.maxLeverage;
      if (leverage > maxLeverage) {
        this.logger.warn(
          `Leverage ${leverage} exceeds maximum allowed leverage ${maxLeverage}`,
        );
        return false;
      }

      // 4. 检查持仓规模
      const maxPositionSize = userRiskLimit?.maxPositionSize || riskControl.maxPositionSize;
      const position = await this.prisma.position.findFirst({
        where: {
          userId,
          symbol,
          side,
        },
      });

      const newPositionSize = (position?.amount || 0) + amount;
      if (newPositionSize > maxPositionSize) {
        this.logger.warn(
          `Position size ${newPositionSize} exceeds maximum allowed size ${maxPositionSize}`,
        );
        return false;
      }

      // 5. 检查日交易量
      const dailyVolume = await this.getDailyVolume(userId, symbol);
      if (dailyVolume + amount * price > riskControl.maxDailyVolume) {
        this.logger.warn(
          `Daily volume ${dailyVolume + amount * price} exceeds maximum allowed volume ${riskControl.maxDailyVolume}`,
        );
        return false;
      }

      // 6. 检查价格偏离
      const marketPrice = await this.getMarketPrice(symbol);
      const priceDeviation = Math.abs(price - marketPrice) / marketPrice;
      if (priceDeviation > riskControl.maxPriceDeviation) {
        this.logger.warn(
          `Price deviation ${priceDeviation} exceeds maximum allowed deviation ${riskControl.maxPriceDeviation}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking order risk:', error);
      return false;
    }
  }

  async checkPositionRisk(
    userId: string,
    symbol: string,
    side: OrderSide,
    amount: number,
    leverage: number,
    entryPrice: number,
  ): Promise<boolean> {
    try {
      // 1. 获取风险控制配置
      const riskControl = await this.prisma.riskControl.findUnique({
        where: { symbol },
      });

      if (!riskControl) {
        this.logger.warn(`No risk control found for symbol ${symbol}`);
        return true;
      }

      // 2. 计算所需保证金
      const requiredMargin = (amount * entryPrice) / leverage;
      const maintenanceMargin = requiredMargin * riskControl.maintMarginRate;

      // 3. 检查用户余额
      const [baseAsset, quoteAsset] = symbol.split('-');
      const balance = await this.assetService.getUserBalance(
        userId,
        side === OrderSide.BUY ? quoteAsset : baseAsset,
      );

      if (balance.balance < requiredMargin) {
        this.logger.warn(
          `User balance ${balance.balance} is insufficient for required margin ${requiredMargin}`,
        );
        return false;
      }

      // 4. 检查总风险敞口
      const totalExposure = await this.calculateTotalExposure(userId);
      const maxExposure = this.configService.get('MAX_USER_EXPOSURE');
      if (totalExposure + amount * entryPrice > maxExposure) {
        this.logger.warn(
          `Total exposure ${totalExposure + amount * entryPrice} exceeds maximum allowed exposure ${maxExposure}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking position risk:', error);
      return false;
    }
  }

  async checkLiquidationRisk(positionId: string): Promise<boolean> {
    try {
      const position = await this.prisma.position.findUnique({
        where: { id: positionId },
      });

      if (!position) {
        this.logger.warn(`Position ${positionId} not found`);
        return false;
      }

      const riskControl = await this.prisma.riskControl.findUnique({
        where: { symbol: position.symbol },
      });

      if (!riskControl) {
        this.logger.warn(`No risk control found for symbol ${position.symbol}`);
        return false;
      }

      // 获取当前市场价格
      const marketPrice = await this.getMarketPrice(position.symbol);

      // 计算未实现盈亏
      const pnl = this.calculateUnrealizedPnl(
        position.side,
        position.amount,
        position.entryPrice,
        marketPrice,
      );

      // 计算当前保证金率
      const currentMarginRate =
        (position.margin + pnl) / (position.amount * marketPrice);

      // 如果当前保证金率低于维持保证金率，触发清算
      if (currentMarginRate < riskControl.maintMarginRate) {
        await this.liquidatePosition(position, marketPrice, 'insufficient_margin');
        return true;
      }

      // 检查止损
      if (
        position.stopLoss &&
        ((position.side === OrderSide.BUY && marketPrice <= position.stopLoss) ||
          (position.side === OrderSide.SELL && marketPrice >= position.stopLoss))
      ) {
        await this.liquidatePosition(position, marketPrice, 'stop_loss');
        return true;
      }

      // 检查止盈
      if (
        position.takeProfit &&
        ((position.side === OrderSide.BUY && marketPrice >= position.takeProfit) ||
          (position.side === OrderSide.SELL && marketPrice <= position.takeProfit))
      ) {
        await this.liquidatePosition(position, marketPrice, 'take_profit');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error checking liquidation risk:', error);
      return false;
    }
  }

  private async liquidatePosition(
    position: any,
    marketPrice: number,
    reason: string,
  ) {
    try {
      await this.prisma.$transaction(async (prisma) => {
        // 1. 创建清算记录
        await prisma.liquidationHistory.create({
          data: {
            userId: position.userId,
            symbol: position.symbol,
            positionId: position.id,
            amount: position.amount,
            price: marketPrice,
            margin: position.margin,
            leverage: position.leverage,
            reason,
          },
        });

        // 2. 关闭仓位
        await prisma.position.delete({
          where: { id: position.id },
        });

        // 3. 计算剩余保证金并返还给用户
        const pnl = this.calculateUnrealizedPnl(
          position.side,
          position.amount,
          position.entryPrice,
          marketPrice,
        );
        const remainingMargin = Math.max(0, position.margin + pnl);

        if (remainingMargin > 0) {
          const [baseAsset, quoteAsset] = position.symbol.split('-');
          await this.assetService.unfreezeBalance(
            position.userId,
            position.side === OrderSide.BUY ? quoteAsset : baseAsset,
            remainingMargin,
          );
        }
      });

      // 4. 发送清算事件
      this.eventEmitter.emit('position.liquidated', {
        userId: position.userId,
        symbol: position.symbol,
        positionId: position.id,
        price: marketPrice,
        reason,
      });
    } catch (error) {
      this.logger.error('Error liquidating position:', error);
      throw error;
    }
  }

  private calculateUnrealizedPnl(
    side: string,
    amount: number,
    entryPrice: number,
    marketPrice: number,
  ): number {
    const direction = side === OrderSide.BUY ? 1 : -1;
    return (marketPrice - entryPrice) * amount * direction;
  }

  private async getDailyVolume(userId: string, symbol: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades = await this.prisma.trade.findMany({
      where: {
        symbol,
        OR: [
          { makerUserId: userId },
          { takerUserId: userId },
        ],
        timestamp: {
          gte: oneDayAgo,
        },
      },
    });

    return trades.reduce((sum, trade) => sum + Number(trade.amount) * Number(trade.price), 0);
  }

  private async calculateTotalExposure(userId: string): Promise<number> {
    const positions = await this.prisma.position.findMany({
      where: { userId },
    });

    return positions.reduce(
      (sum, pos) => sum + Number(pos.amount) * Number(pos.markPrice),
      0,
    );
  }

  private async getMarketPrice(symbol: string): Promise<number> {
    const trade = await this.prisma.trade.findFirst({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
    });

    if (!trade) {
      throw new Error(`No trade found for symbol ${symbol}`);
    }

    return Number(trade.price);
  }
}
