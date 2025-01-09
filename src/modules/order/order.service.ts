import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import {
  CreateOrderDto,
  OrderResponseDto,
  OrderStatus,
  OrderType,
  OrderSide,
  OrderQueryDto,
  OrderUpdateDto,
  OrderMatchDto,
} from './dto/order.dto';
import { OrderMatchingEngine } from './matching/order-matching.engine';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderService.name);
  private readonly matchingEngines = new Map<string, OrderMatchingEngine>();

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.initializeMatchingEngines();
  }

  async onModuleDestroy() {
    // 清理资源
    this.matchingEngines.clear();
  }

  private async initializeMatchingEngines() {
    try {
      const tradingPairs = await this.prisma.tradingPair.findMany({
        where: { isActive: true },
      });

      for (const pair of tradingPairs) {
        const engine = new OrderMatchingEngine(pair.symbol);
        await this.loadExistingOrders(engine, pair.symbol);
        this.matchingEngines.set(pair.symbol, engine);
      }

      this.logger.log(`Initialized matching engines for ${tradingPairs.length} trading pairs`);
    } catch (error) {
      this.logger.error('Failed to initialize matching engines:', error);
      throw error;
    }
  }

  private async loadExistingOrders(engine: OrderMatchingEngine, symbol: string) {
    const activeOrders = await this.prisma.order.findMany({
      where: {
        symbol,
        status: {
          in: [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const order of activeOrders) {
      engine.addOrder({
        id: order.id,
        userId: order.userId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        price: order.price,
        quantity: order.remainingQuantity,
        timeInForce: order.timeInForce,
        timestamp: order.createdAt.getTime(),
      });
    }
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    const engine = this.matchingEngines.get(createOrderDto.symbol);
    if (!engine) {
      throw new Error('Trading pair not found');
    }

    // 创建订单记录
    const order = await this.prisma.order.create({
      data: {
        id: uuidv4(),
        userId,
        symbol: createOrderDto.symbol,
        type: createOrderDto.type,
        side: createOrderDto.side,
        price: createOrderDto.price || 0,
        quantity: createOrderDto.quantity,
        remainingQuantity: createOrderDto.quantity,
        stopPrice: createOrderDto.stopPrice,
        timeInForce: createOrderDto.timeInForce,
        clientOrderId: createOrderDto.clientOrderId,
        status: OrderStatus.NEW,
      },
    });

    // 将订单添加到匹配引擎
    if (order.type === OrderType.LIMIT) {
      const matches = engine.addOrder({
        id: order.id,
        userId: order.userId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        price: order.price,
        quantity: order.remainingQuantity,
        timeInForce: order.timeInForce,
        timestamp: order.createdAt.getTime(),
      });

      // 处理订单匹配
      if (matches.length > 0) {
        await this.processMatches(matches);
      }
    } else if (order.type === OrderType.MARKET) {
      const matches = engine.executeMarketOrder({
        id: order.id,
        userId: order.userId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        timestamp: order.createdAt.getTime(),
      });

      await this.processMatches(matches);
    }

    // 发送订单创建事件
    this.eventEmitter.emit('order.created', order);

    return this.mapOrderToResponse(order);
  }

  async cancelOrder(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new Error('Order not found');
    }

    if (order.status !== OrderStatus.NEW && order.status !== OrderStatus.PARTIALLY_FILLED) {
      throw new Error('Order cannot be canceled');
    }

    const engine = this.matchingEngines.get(order.symbol);
    if (!engine) {
      throw new Error('Trading pair not found');
    }

    // 从匹配引擎中移除订单
    engine.cancelOrder(orderId);

    // 更新订单状态
    const canceledOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELED,
        updatedAt: new Date(),
      },
    });

    // 发送订单取消事件
    this.eventEmitter.emit('order.canceled', canceledOrder);

    return this.mapOrderToResponse(canceledOrder);
  }

  async getOrder(userId: string, orderId: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.userId !== userId) {
      throw new Error('Order not found');
    }

    return this.mapOrderToResponse(order);
  }

  async getOrders(userId: string, query: OrderQueryDto): Promise<OrderResponseDto[]> {
    const where: any = { userId };

    if (query.symbol) where.symbol = query.symbol;
    if (query.status) where.status = query.status;
    if (query.side) where.side = query.side;
    if (query.startTime || query.endTime) {
      where.createdAt = {};
      if (query.startTime) where.createdAt.gte = new Date(query.startTime);
      if (query.endTime) where.createdAt.lte = new Date(query.endTime);
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });

    return orders.map(order => this.mapOrderToResponse(order));
  }

  private async processMatches(matches: OrderMatchDto[]) {
    for (const match of matches) {
      try {
        await this.prisma.$transaction(async (prisma) => {
          // 更新maker订单
          const makerOrder = await prisma.order.update({
            where: { id: match.makerOrderId },
            data: {
              filledQuantity: { increment: match.quantity },
              remainingQuantity: { decrement: match.quantity },
              status: this.getUpdatedOrderStatus(match.quantity),
              lastFilledPrice: match.price,
              lastFilledQuantity: match.quantity,
              updatedAt: match.timestamp,
            },
          });

          // 更新taker订单
          const takerOrder = await prisma.order.update({
            where: { id: match.takerOrderId },
            data: {
              filledQuantity: { increment: match.quantity },
              remainingQuantity: { decrement: match.quantity },
              status: this.getUpdatedOrderStatus(match.quantity),
              lastFilledPrice: match.price,
              lastFilledQuantity: match.quantity,
              updatedAt: match.timestamp,
            },
          });

          // 创建交易记录
          await prisma.trade.create({
            data: {
              symbol: makerOrder.symbol,
              price: match.price,
              quantity: match.quantity,
              makerOrderId: match.makerOrderId,
              takerOrderId: match.takerOrderId,
              makerUserId: makerOrder.userId,
              takerUserId: takerOrder.userId,
              timestamp: match.timestamp,
            },
          });

          // 发送订单更新事件
          this.eventEmitter.emit('order.updated', makerOrder);
          this.eventEmitter.emit('order.updated', takerOrder);
        });
      } catch (error) {
        this.logger.error(`Failed to process match: ${error.message}`, error);
        throw error;
      }
    }
  }

  private getUpdatedOrderStatus(remainingQuantity: number): OrderStatus {
    return remainingQuantity === 0 ? OrderStatus.FILLED : OrderStatus.PARTIALLY_FILLED;
  }

  private mapOrderToResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      type: order.type,
      side: order.side,
      status: order.status,
      price: order.price,
      quantity: order.quantity,
      filledQuantity: order.filledQuantity,
      remainingQuantity: order.remainingQuantity,
      stopPrice: order.stopPrice,
      timeInForce: order.timeInForce,
      clientOrderId: order.clientOrderId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
