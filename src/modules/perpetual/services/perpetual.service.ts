import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrometheusService } from '../../../modules/prometheus/prometheus.service';
import { RiskManagementService } from '../services/risk-management.service';
import { ADLService } from '../services/adl.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BigNumber } from 'bignumber.js';

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
      this.prometheusService.incrementOrderCounter(
        order.type,
        order.status,
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

    if (!balance || new BigNumber(balance.available).isLessThan(orderData.margin)) {
      throw new Error('Insufficient margin');
    }
  }

  private async lockMargin(userId: string, orderData: any) {
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
    });

    if (!balance) {
      throw new Error('Balance not found');
    }

    await this.prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
      data: {
        available: new BigNumber(balance.available).minus(orderData.margin).toString(),
        locked: new BigNumber(balance.locked).plus(orderData.margin).toString(),
      },
    });
  }

  private async unlockMargin(userId: string, orderData: any) {
    const balance = await this.prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
    });

    if (!balance) {
      throw new Error('Balance not found');
    }

    await this.prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency: 'USDT',
        },
      },
      data: {
        available: new BigNumber(balance.available).plus(orderData.margin).toString(),
        locked: new BigNumber(balance.locked).minus(orderData.margin).toString(),
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
