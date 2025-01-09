import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MarketService } from '../market.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Redis } from 'ioredis';
import { KlineInterval } from '../dto/market.dto';

describe('MarketService', () => {
  let service: MarketService;
  let prismaService: PrismaService;
  let redisClient: Redis;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'BINANCE_WS_ENDPOINT': 'wss://test.binance.com/ws',
        'COINGECKO_API_ENDPOINT': 'https://test.coingecko.com/api/v3',
        'MARKET_UPDATE_INTERVAL': '60000',
      };
      return config[key];
    }),
  };

  const mockPrismaService = {
    tradingPair: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    kline: {
      findMany: jest.fn(),
    },
    orderBook: {
      findUnique: jest.fn(),
    },
    trade: {
      findMany: jest.fn(),
    },
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    del: jest.fn(),
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisClient = module.get('REDIS_CLIENT');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTickerPrice', () => {
    it('should return ticker data from cache', async () => {
      const mockTickerData = {
        symbol: 'BTC-USDT',
        price: '50000',
        volume: '100',
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockTickerData));

      const result = await service.getTickerPrice('BTC-USDT');
      expect(result).toEqual(mockTickerData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('ticker:BTC-USDT');
    });

    it('should throw error when ticker data not available', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(service.getTickerPrice('BTC-USDT')).rejects.toThrow(
        'Ticker data not available',
      );
    });
  });

  describe('getKlineData', () => {
    it('should return kline data', async () => {
      const mockKlines = [
        {
          timestamp: new Date(),
          open: '50000',
          high: '51000',
          low: '49000',
          close: '50500',
          volume: '100',
        },
      ];

      mockPrismaService.kline.findMany.mockResolvedValue(mockKlines);

      const result = await service.getKlineData('BTC-USDT', {
        interval: KlineInterval.ONE_HOUR,
        limit: 100,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.kline.findMany).toHaveBeenCalled();
    });
  });

  describe('getOrderBook', () => {
    it('should return order book data', async () => {
      const mockOrderBook = {
        symbol: 'BTC-USDT',
        bids: [{ price: '50000', quantity: '1' }],
        asks: [{ price: '50100', quantity: '1' }],
      };

      mockPrismaService.orderBook.findUnique.mockResolvedValue(mockOrderBook);

      const result = await service.getOrderBook('BTC-USDT', { limit: 100 });
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTC-USDT');
      expect(mockPrismaService.orderBook.findUnique).toHaveBeenCalled();
    });

    it('should throw error when order book not found', async () => {
      mockPrismaService.orderBook.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderBook('BTC-USDT', { limit: 100 }),
      ).rejects.toThrow('Order book not found');
    });
  });

  describe('subscribeToMarketData', () => {
    it('should subscribe to market data', async () => {
      const clientId = 'test-client';
      const symbol = 'BTC-USDT';
      const channel = 'ticker';

      await service.subscribeToMarketData(clientId, symbol, channel);

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        `subscriptions:${clientId}`,
        `${symbol}:${channel}`,
        expect.any(Number),
      );
    });
  });

  describe('unsubscribeFromMarketData', () => {
    it('should unsubscribe from market data', async () => {
      const clientId = 'test-client';
      const symbol = 'BTC-USDT';
      const channel = 'ticker';

      await service.unsubscribeFromMarketData(clientId, symbol, channel);

      expect(mockRedisClient.hdel).toHaveBeenCalledWith(
        `subscriptions:${clientId}`,
        `${symbol}:${channel}`,
      );
    });
  });
});
