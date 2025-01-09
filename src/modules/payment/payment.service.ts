import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentOrderDto, UpdatePaymentOrderDto, CreateTransactionDto, PaymentStatus } from './dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  async createPaymentOrder(dto: CreatePaymentOrderDto) {
    try {
      return await this.prisma.paymentOrder.create({
        data: {
          userId: dto.userId,
          amount: dto.amount,
          currency: dto.currency,
          paymentMethod: dto.paymentMethod,
          description: dto.description,
          status: PaymentStatus.PENDING,
        },
      });
    } catch (error) {
      throw new BadRequestException('创建支付订单失败');
    }
  }

  async updatePaymentOrder(id: number, dto: UpdatePaymentOrderDto) {
    try {
      const paymentOrder = await this.prisma.paymentOrder.findUnique({
        where: { id },
      });

      if (!paymentOrder) {
        throw new NotFoundException('支付订单不存在');
      }

      return await this.prisma.paymentOrder.update({
        where: { id },
        data: {
          status: dto.status,
          transactionId: dto.transactionId,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('更新支付订单失败');
    }
  }

  async createTransaction(dto: CreateTransactionDto) {
    try {
      const paymentOrder = await this.prisma.paymentOrder.findUnique({
        where: { id: dto.paymentOrderId },
      });

      if (!paymentOrder) {
        throw new NotFoundException('支付订单不存在');
      }

      return await this.prisma.transaction.create({
        data: {
          userId: dto.userId,
          paymentOrderId: dto.paymentOrderId,
          amount: dto.amount,
          currency: dto.currency,
          status: dto.status,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('创建交易记录失败');
    }
  }

  async getUserTransactions(userId: number) {
    try {
      return await this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new BadRequestException('获取用户交易记录失败');
    }
  }

  async getUserPaymentOrders(userId: number) {
    try {
      return await this.prisma.paymentOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      throw new BadRequestException('获取用户支付订单失败');
    }
  }
} 