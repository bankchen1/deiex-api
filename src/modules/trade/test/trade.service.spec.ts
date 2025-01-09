import { Test, TestingModule } from '@nestjs/testing';
import { TradeService } from '../trade.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetService } from '../../asset/asset.service';
import { RiskService } from '../../risk/risk.service';
import { REDIS_CLIENT } from '../../redis/redis.types';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderSide, OrderStatus, OrderType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('TradeService', () => {
  let service: TradeService;
  let prismaService: PrismaService;
  let assetService: AssetService;
  let riskService: RiskService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    trade: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    position: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockAssetService = {
    getUserBalance: jest.fn(),
    freezeBalance: jest.fn(),
    unfreezeBalance: jest.fn(),
  };

  const mockRiskService = {
    checkOrderRisk: jest.fn(),
    checkPositionRisk: jest.fn(),
    checkLiquidationRisk: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AssetService,
          useValue: mockAssetService,
        },
        {
          provide: RiskService,
          useValue: mockRiskService,
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

    service = module.get<TradeService>(TradeService);
    prismaService = module.get<PrismaService>(PrismaService);
    assetService = module.get<AssetService>(AssetService);
    riskService = module.get<RiskService>(RiskService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTradeDetail', () => {
    it('should return trade details', async () => {
      const userId = 'user1';
      const tradeId = 'trade1';
      const mockTrade = {
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

      mockPrismaService.trade.findFirst.mockResolvedValue(mockTrade);

      const result = await service.getTradeDetail(userId, tradeId);
      expect(result).toEqual(mockTrade);
      expect(mockPrismaService.trade.findFirst).toHaveBeenCalledWith({
        where: {
          id: tradeId,
          OR: [
            { makerUserId: userId },
            { takerUserId: userId },
          ],
        },
      });
    });

    it('should throw NotFoundException when trade not found', async () => {
      mockPrismaService.trade.findFirst.mockResolvedValue(null);

      await expect(service.getTradeDetail('user1', 'trade1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('closeTrade', () => {
    const userId = 'user1';
    const tradeId = 'trade1';
    const mockTrade = {
      id: tradeId,
      symbol: 'BTC-USDT',
      price: 50000,
      amount: 1,
      makerOrderId: 'order1',
      takerOrderId: 'order2',
      makerUserId: userId,
      takerUserId: 'user2',
      side: OrderSide.BUY,
    };

    const mockOrder = {
      id: 'order1',
      userId,
      side: OrderSide.BUY,
      status: OrderStatus.PARTIALLY_FILLED,
    };

    const mockPosition = {
      id: 'position1',
      userId,
      symbol: 'BTC-USDT',
      side: OrderSide.BUY,
      amount: 1,
      entryPrice: 49000,
      margin: 49000,
      realizedPnl: 0,
    };

    beforeEach(() => {
      mockPrismaService.trade.findFirst.mockResolvedValue(mockTrade);
      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.position.findFirst.mockResolvedValue(mockPosition);
      mockPrismaService.position.update.mockResolvedValue({ ...mockPosition, amount: 0 });
      mockPrismaService.order.update.mockResolvedValue({ ...mockOrder, status: OrderStatus.FILLED });
      mockPrismaService.trade.update.mockResolvedValue({ ...mockTrade, profit: 1000 });
    });

    it('should close trade successfully', async () => {
      const result = await service.closeTrade(userId, tradeId);

      expect(result).toBeDefined();
      expect(mockPrismaService.position.update).toHaveBeenCalled();
      expect(mockPrismaService.order.update).toHaveBeenCalled();
      expect(mockPrismaService.trade.update).toHaveBeenCalled();
      expect(mockAssetService.unfreezeBalance).toHaveBeenCalled();
    });

    it('should throw NotFoundException when trade not found', async () => {
      mockPrismaService.trade.findFirst.mockResolvedValue(null);

      await expect(service.closeTrade(userId, tradeId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.closeTrade(userId, tradeId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when position not found', async () => {
      mockPrismaService.position.findFirst.mockResolvedValue(null);

      await expect(service.closeTrade(userId, tradeId)).rejects.toThrow(NotFoundException);
    });
  });
});
