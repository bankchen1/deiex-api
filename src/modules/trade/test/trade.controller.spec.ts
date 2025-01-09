import { Test, TestingModule } from '@nestjs/testing';
import { TradeController } from '../trade.controller';
import { TradeService } from '../trade.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetService } from '../../asset/asset.service';
import { RiskService } from '../../risk/risk.service';
import { REDIS_CLIENT, RedisClient } from '../../redis/redis.types';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderSide, OrderType, OrderStatus } from '@prisma/client';
import { CreateOrderDto, OrderResponseDto, TradeResponseDto } from '../dto/trade.dto';

describe('TradeController', () => {
  let controller: TradeController;
  let service: TradeService;

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockTradeService = {
    createOrder: jest.fn(),
    cancelOrder: jest.fn(),
    getOrderBook: jest.fn(),
    getUserOrders: jest.fn(),
    getTradeDetail: jest.fn(),
    closeTrade: jest.fn(),
    getUserTrades: jest.fn(),
    getTradeStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradeController],
      providers: [
        {
          provide: TradeService,
          useValue: mockTradeService,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AssetService,
          useValue: {},
        },
        {
          provide: RiskService,
          useValue: {},
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TradeController>(TradeController);
    service = module.get<TradeService>(TradeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createOrder', () => {
    it('should create a new order', async () => {
      const createOrderDto: CreateOrderDto = {
        symbol: 'BTC-USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 1,
        leverage: 1,
      };

      const expectedResponse: OrderResponseDto = {
        id: '1',
        userId: 'user1',
        symbol: 'BTC-USDT',
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        price: 50000,
        amount: 1,
        filled: 0,
        remaining: 1,
        status: OrderStatus.NEW,
        leverage: 1,
        margin: 50000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTradeService.createOrder.mockResolvedValue(expectedResponse);

      const result = await controller.createOrder({ user: { id: 'user1' } }, createOrderDto);
      expect(result).toEqual(expectedResponse);
      expect(mockTradeService.createOrder).toHaveBeenCalledWith('user1', createOrderDto);
    });
  });

  describe('getTradeDetail', () => {
    it('should get trade details', async () => {
      const tradeId = '1';
      const userId = 'user1';
      const expectedResponse: TradeResponseDto = {
        id: tradeId,
        symbol: 'BTC-USDT',
        price: 50000,
        amount: 1,
        makerOrderId: 'order1',
        takerOrderId: 'order2',
        makerUserId: userId,
        takerUserId: 'user2',
        side: OrderSide.BUY,
        fee: 0.1,
        feeCurrency: 'USDT',
        createdAt: new Date(),
      };

      mockTradeService.getTradeDetail.mockResolvedValue(expectedResponse);

      const result = await controller.getTradeDetail({ user: { id: userId } }, tradeId);
      expect(result).toEqual(expectedResponse);
      expect(mockTradeService.getTradeDetail).toHaveBeenCalledWith(userId, tradeId);
    });
  });

  describe('closeTrade', () => {
    it('should close a trade', async () => {
      const tradeId = '1';
      const userId = 'user1';
      const expectedResponse: TradeResponseDto = {
        id: tradeId,
        symbol: 'BTC-USDT',
        price: 50000,
        amount: 1,
        makerOrderId: 'order1',
        takerOrderId: 'order2',
        makerUserId: userId,
        takerUserId: 'user2',
        side: OrderSide.BUY,
        fee: 0.1,
        feeCurrency: 'USDT',
        createdAt: new Date(),
        profit: 1000,
        profitPercent: 2,
      };

      mockTradeService.closeTrade.mockResolvedValue(expectedResponse);

      const result = await controller.closeTrade({ user: { id: userId } }, tradeId);
      expect(result).toEqual(expectedResponse);
      expect(mockTradeService.closeTrade).toHaveBeenCalledWith(userId, tradeId);
    });
  });
});
