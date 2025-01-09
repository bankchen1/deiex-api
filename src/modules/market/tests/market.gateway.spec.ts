import { Test, TestingModule } from '@nestjs/testing';
import { MarketGateway } from '../gateways/market.gateway';
import { MarketService } from '../market.service';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

describe('MarketGateway', () => {
  let gateway: MarketGateway;
  let marketService: MarketService;

  const mockMarketService = {
    subscribeToMarketData: jest.fn(),
    unsubscribeFromMarketData: jest.fn(),
    getTickerPrice: jest.fn(),
    getOrderBook: jest.fn(),
    getKlineData: jest.fn(),
    getRecentTrades: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketGateway,
        {
          provide: MarketService,
          useValue: mockMarketService,
        },
      ],
    }).compile();

    gateway = module.get<MarketGateway>(MarketGateway);
    marketService = module.get<MarketService>(MarketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should handle new client connection', async () => {
      const mockClient = {
        id: 'test-client',
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should cleanup client subscriptions on disconnect', async () => {
      const mockClient = {
        id: 'test-client',
      } as Socket;

      await gateway.handleDisconnect(mockClient);
      expect(marketService.unsubscribeFromMarketData).toHaveBeenCalledWith(
        'test-client',
      );
    });
  });

  describe('handleSubscribe', () => {
    const mockClient = {
      id: 'test-client',
      emit: jest.fn(),
    } as unknown as Socket;

    it('should handle valid subscription request', async () => {
      const message = {
        symbol: 'BTC-USDT',
        channel: 'ticker',
      };

      const mockTickerData = {
        price: '50000',
        volume: '100',
      };

      mockMarketService.getTickerPrice.mockResolvedValue(mockTickerData);

      const result = await gateway.handleSubscribe(mockClient, message);

      expect(result).toEqual({
        event: 'subscribed',
        data: { symbol: 'BTC-USDT', channel: 'ticker' },
      });

      expect(marketService.subscribeToMarketData).toHaveBeenCalledWith(
        'test-client',
        'BTC-USDT',
        'ticker',
      );

      expect(mockClient.emit).toHaveBeenCalledWith('data', {
        symbol: 'BTC-USDT',
        channel: 'ticker',
        data: mockTickerData,
      });
    });

    it('should reject invalid subscription request', async () => {
      const message = {
        symbol: '',
        channel: '',
      };

      await expect(gateway.handleSubscribe(mockClient, message)).rejects.toThrow(
        WsException,
      );

      expect(marketService.subscribeToMarketData).not.toHaveBeenCalled();
    });
  });

  describe('handleUnsubscribe', () => {
    const mockClient = {
      id: 'test-client',
    } as Socket;

    it('should handle valid unsubscription request', async () => {
      const message = {
        symbol: 'BTC-USDT',
        channel: 'ticker',
      };

      const result = await gateway.handleUnsubscribe(mockClient, message);

      expect(result).toEqual({
        event: 'unsubscribed',
        data: { symbol: 'BTC-USDT', channel: 'ticker' },
      });

      expect(marketService.unsubscribeFromMarketData).toHaveBeenCalledWith(
        'test-client',
        'BTC-USDT',
        'ticker',
      );
    });

    it('should reject invalid unsubscription request', async () => {
      const message = {
        symbol: '',
        channel: '',
      };

      await expect(gateway.handleUnsubscribe(mockClient, message)).rejects.toThrow(
        WsException,
      );

      expect(marketService.unsubscribeFromMarketData).not.toHaveBeenCalled();
    });
  });

  describe('broadcastMarketData', () => {
    it('should broadcast market data to all clients', () => {
      const channel = 'ticker';
      const data = {
        symbol: 'BTC-USDT',
        price: '50000',
      };

      gateway.server = {
        emit: jest.fn(),
      } as any;

      gateway.broadcastMarketData(channel, data);

      expect(gateway.server.emit).toHaveBeenCalledWith(channel, data);
    });
  });
});
