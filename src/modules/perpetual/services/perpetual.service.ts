import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrometheusService } from '../../shared/prometheus/prometheus.service';
import { RiskManagementService } from './risk-management.service';
import { ADLService } from './adl.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PerpetualService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prometheusService: PrometheusService,
    private readonly riskManagementService: RiskManagementService,
    private readonly adlService: ADLService,
    private readonly prisma: PrismaService,
  ) {}

  async createOrder(userId: string, orderData: any) {
    // Validate order parameters
    this.validateOrderParameters(orderData);

    // Check margin requirements
    await this.checkMarginRequirements(userId, orderData);

    // Lock margin
    await this.lockMargin(userId, orderData);

    try {
      // Create order in database
      const order = await this.prisma.order.create({
        data: {
          userId,
          symbol: orderData.symbol,
          side: orderData.side,
          type: orderData.type,
          price: orderData.price,
          quantity: orderData.quantity,
          leverage: orderData.leverage,
          margin: orderData.margin,
          timeInForce: orderData.timeInForce,
          status: 'NEW',
        },
      });

      // Track metrics
      this.prometheusService.incrementOrderCount(
        order.symbol,
        order.side,
        order.type,
      );

      return order;
    } catch (error) {
      // Unlock margin if order creation fails
      await this.unlockMargin(userId, orderData);
      throw error;
    }
  }

  private validateOrderParameters(orderData: any) {
    // Implement order parameter validation
    // Check symbol, side, type, price, quantity, leverage, etc.
  }

  private async checkMarginRequirements(userId: string, orderData: any) {
    // Check if user has sufficient margin
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
    });

    if (!balance || parseFloat(balance.available) < parseFloat(orderData.margin)) {
      throw new Error('Insufficient margin');
    }
  }

  private async lockMargin(userId: string, orderData: any) {
    // Lock margin for the order
    await this.prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
      data: {
        available: {
          decrement: orderData.margin,
        },
        locked: {
          increment: orderData.margin,
        },
      },
    });
  }

  private async unlockMargin(userId: string, orderData: any) {
    // Unlock margin if order fails
    await this.prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
      data: {
        available: {
          increment: orderData.margin,
        },
        locked: {
          decrement: orderData.margin,
        },
      },
    });
  }

  async getPosition(userId: string, symbol: string, side: string) {
    return this.prisma.position.findUnique({
      where: {
        userId_symbol_side: {
          userId,
          symbol,
          side,
        },
      },
    });
  }

  async updatePosition(positionId: string, data: any) {
    return this.prisma.position.update({
      where: { id: positionId },
      data,
    });
  }

  async getOpenOrders(userId: string) {
    return this.prisma.order.findMany({
      where: {
        userId,
        status: 'NEW',
      },
    });
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new Error('Order not found');
    }

    if (order.status !== 'NEW') {
      throw new Error('Order cannot be cancelled');
    }

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELED' },
    });

    // Unlock margin
    await this.unlockMargin(userId, order);

    return { success: true };
  }
}
