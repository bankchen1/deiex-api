import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateOrderDto,
  OrderDto,
  OrderStatus,
  OrderType,
  OrderSide,
  PositionDto,
  PositionSide,
  UpdateLeverageDto,
  FundingRateDto,
  TradeHistoryDto,
} from './dto/perpetual.dto';

@Injectable()
export class PerpetualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async validateOrder(dto: CreateOrderDto) {
    if (dto.type === OrderType.MARKET && dto.price) {
      throw new BadRequestException('Market orders should not specify a price');
    }

    if (
      (dto.type === OrderType.STOP_LOSS || dto.type === OrderType.TAKE_PROFIT) &&
      !dto.stopPrice
    ) {
      throw new BadRequestException('Stop orders must specify a stop price');
    }

    if (dto.leverage < 1 || dto.leverage > 125) {
      throw new BadRequestException('Leverage must be between 1 and 125');
    }

    const symbol = await this.prisma.symbol.findUnique({
      where: { name: dto.symbol },
    });

    if (!symbol) {
      throw new NotFoundException(`Symbol ${dto.symbol} not found`);
    }

    return symbol;
  }

  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderDto> {
    const symbol = await this.validateOrder(dto);

    const order = await this.prisma.order.create({
      data: {
        userId,
        symbol: dto.symbol,
        side: dto.side,
        type: dto.type,
        origQty: new Decimal(dto.quantity),
        price: dto.price ? new Decimal(dto.price) : null,
        stopPrice: dto.stopPrice ? new Decimal(dto.stopPrice) : null,
        leverage: dto.leverage,
        reduceOnly: dto.reduceOnly || false,
        clientOrderId: dto.clientOrderId,
        status: OrderStatus.NEW,
      },
    });

    this.eventEmitter.emit('order.created', order);

    return order;
  }

  async cancelOrder(userId: string, orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.NEW && order.status !== OrderStatus.PARTIALLY_FILLED) {
      throw new BadRequestException('Order cannot be canceled');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELED },
    });

    this.eventEmitter.emit('order.canceled', updatedOrder);

    return updatedOrder;
  }

  async getOrder(userId: string, orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getOpenOrders(userId: string, symbol?: string): Promise<OrderDto[]> {
    return await this.prisma.order.findMany({
      where: {
        userId,
        symbol,
        status: {
          in: [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getOrderHistory(
    userId: string,
    symbol?: string,
    page = 1,
    limit = 100,
  ): Promise<OrderDto[]> {
    return await this.prisma.order.findMany({
      where: {
        userId,
        symbol,
        status: {
          in: [OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.REJECTED, OrderStatus.EXPIRED],
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPosition(userId: string, symbol: string): Promise<PositionDto | null> {
    return await this.prisma.position.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol,
        },
      },
    });
  }

  async getPositions(userId: string): Promise<PositionDto[]> {
    return await this.prisma.position.findMany({
      where: {
        userId,
        quantity: {
          not: new Decimal(0),
        },
      },
    });
  }

  async updateLeverage(
    userId: string,
    dto: UpdateLeverageDto,
  ): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol: dto.symbol,
        },
      },
    });

    if (position && position.quantity.toString() !== '0') {
      throw new BadRequestException('Cannot change leverage while position is open');
    }

    await this.prisma.position.upsert({
      where: {
        userId_symbol: {
          userId,
          symbol: dto.symbol,
        },
      },
      update: {
        leverage: dto.leverage,
      },
      create: {
        userId,
        symbol: dto.symbol,
        leverage: dto.leverage,
        quantity: new Decimal(0),
        entryPrice: new Decimal(0),
        markPrice: new Decimal(0),
        liquidationPrice: new Decimal(0),
        maintMarginRate: new Decimal(0),
        unrealizedPnl: new Decimal(0),
        realizedPnl: new Decimal(0),
      },
    });
  }

  async getFundingRate(symbol: string): Promise<FundingRateDto> {
    const fundingRate = await this.redis.hgetall(`funding_rate:${symbol}`);
    
    if (!fundingRate || !fundingRate.rate) {
      throw new NotFoundException(`Funding rate for ${symbol} not found`);
    }

    return {
      symbol,
      fundingRate: fundingRate.rate,
      nextFundingRate: fundingRate.nextRate || '0',
      nextFundingTime: new Date(parseInt(fundingRate.nextTime) || Date.now() + 8 * 3600 * 1000),
    };
  }

  async getTradeHistory(
    userId: string,
    symbol?: string,
    page = 1,
    limit = 100,
  ): Promise<TradeHistoryDto[]> {
    return await this.prisma.trade.findMany({
      where: {
        userId,
        symbol,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async closePosition(userId: string, symbol: string): Promise<OrderDto> {
    const position = await this.getPosition(userId, symbol);

    if (!position || position.quantity.toString() === '0') {
      throw new BadRequestException('No position to close');
    }

    return await this.createOrder(userId, {
      symbol,
      side: position.side === PositionSide.LONG ? OrderSide.SELL : OrderSide.BUY,
      type: OrderType.MARKET,
      quantity: position.quantity.toString(),
      leverage: position.leverage,
      reduceOnly: true,
    });
  }
}
