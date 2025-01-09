import { Test, TestingModule } from '@nestjs/testing';
import { MarketController } from '../market.controller';
import { MarketService } from '../market.service';

describe('MarketController', () => {
  let controller: MarketController;
  let service: MarketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketController],
      providers: [
        {
          provide: MarketService,
          useValue: {
            getTicker: jest.fn().mockResolvedValue({
              symbol: 'BTCUSDT',
              price: '50000',
              volume: '100',
              change: '2.5'
            }),
            getOrderBook: jest.fn().mockResolvedValue({
              symbol: 'BTCUSDT',
              bids: [],
              asks: []
            }),
            getKlines: jest.fn().mockResolvedValue([])
          }
        }
      ]
    }).compile();

    controller = module.get<MarketController>(MarketController);
    service = module.get<MarketService>(MarketService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTicker', () => {
    it('should return ticker data', async () => {
      const result = await controller.getTicker('BTCUSDT');
      expect(result).toHaveProperty('symbol', 'BTCUSDT');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('volume');
      expect(result).toHaveProperty('change');
    });
  });
});
