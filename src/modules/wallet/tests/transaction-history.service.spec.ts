import { Test, TestingModule } from '@nestjs/testing';
import { TransactionHistoryService } from '../services/transaction-history.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { 
  TransactionType,
  TransactionStatus,
} from '../types/wallet.types';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('TransactionHistoryService', () => {
  let service: TransactionHistoryService;
  let prismaService: DeepMockProxy<PrismaService>;

  const mockUserId = 'user-123';
  const mockCurrency = 'BTC';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        RedisModule.forRoot({
          config: {
            host: 'localhost',
            port: 6379,
            db: 1,
          },
        }),
      ],
      providers: [
        TransactionHistoryService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
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
            on: jest.fn(),
          },
        },
        {
          provide: PrometheusService,
          useValue: {
            recordLatency: jest.fn(),
            incrementErrors: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionHistoryService>(TransactionHistoryService);
    prismaService = module.get(PrismaService);
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history with pagination', async () => {
      // Mock data
      const mockTransactions = [
        {
          id: 'tx-1',
          userId: mockUserId,
          currency: mockCurrency,
          type: TransactionType.DEPOSIT,
          amount: 1,
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
        {
          id: 'tx-2',
          userId: mockUserId,
          currency: mockCurrency,
          type: TransactionType.WITHDRAW,
          amount: 0.5,
          status: TransactionStatus.COMPLETED,
          createdAt: new Date(),
        },
      ];

      // Mock prisma queries
      prismaService.walletTransaction.findMany.mockResolvedValue(mockTransactions);
      prismaService.walletTransaction.count.mockResolvedValue(2);

      // Execute test
      const result = await service.getTransactionHistory(mockUserId, {
        currency: mockCurrency,
        page: 1,
        limit: 10,
      });

      // Verify results
      expect(result).toBeDefined();
      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);

      // Verify interactions
      expect(prismaService.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUserId,
            currency: mockCurrency,
          },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 10,
        })
      );
    });

    it('should apply filters correctly', async () => {
      // Mock data
      const mockTransactions = [{
        id: 'tx-1',
        userId: mockUserId,
        currency: mockCurrency,
        type: TransactionType.DEPOSIT,
        amount: 1,
        status: TransactionStatus.COMPLETED,
        createdAt: new Date(),
      }];

      // Mock prisma queries
      prismaService.walletTransaction.findMany.mockResolvedValue(mockTransactions);
      prismaService.walletTransaction.count.mockResolvedValue(1);

      // Execute test
      const result = await service.getTransactionHistory(mockUserId, {
        currency: mockCurrency,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
        startTime: new Date('2025-01-01'),
        endTime: new Date('2025-01-08'),
      });

      // Verify results
      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);

      // Verify filter application
      expect(prismaService.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUserId,
            currency: mockCurrency,
            type: TransactionType.DEPOSIT,
            status: TransactionStatus.COMPLETED,
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
        })
      );
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction statistics', async () => {
      // Mock aggregation result
      prismaService.walletTransaction.aggregate.mockResolvedValue({
        _count: { id: 10 },
        _sum: {
          amount: 5,
          fee: 0.1,
        },
      });

      // Execute test
      const result = await service.getTransactionStats(mockUserId, {
        currency: mockCurrency,
        type: TransactionType.DEPOSIT,
      });

      // Verify results
      expect(result).toBeDefined();
      expect(result.totalCount).toBe(10);
      expect(result.totalAmount).toBe(5);
      expect(result.totalFee).toBe(0.1);

      // Verify query
      expect(prismaService.walletTransaction.aggregate).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: mockUserId,
          currency: mockCurrency,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
        }),
        _count: { id: true },
        _sum: { amount: true, fee: true },
      });
    });
  });

  describe('getDailyTransactionStats', () => {
    it('should return daily transaction statistics', async () => {
      // Mock raw query result
      const mockStats = [
        {
          date: new Date('2025-01-08'),
          count: '2',
          amount: '1.5',
          fee: '0.01',
        },
      ];
      prismaService.$queryRaw.mockResolvedValue(mockStats);

      // Execute test
      const result = await service.getDailyTransactionStats(mockUserId, {
        currency: mockCurrency,
      });

      // Verify results
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2025-01-08',
        count: 2,
        amount: 1.5,
        fee: 0.01,
      });
    });
  });

  describe('searchTransactions', () => {
    it('should search transactions by term', async () => {
      // Mock search results
      const mockTransactions = [{
        id: 'tx-1',
        txHash: '0x123...',
        userId: mockUserId,
        currency: mockCurrency,
      }];
      prismaService.walletTransaction.findMany.mockResolvedValue(mockTransactions);
      prismaService.walletTransaction.count.mockResolvedValue(1);

      // Execute test
      const result = await service.searchTransactions(
        mockUserId,
        '0x123',
        { currency: mockCurrency }
      );

      // Verify results
      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);

      // Verify search query
      expect(prismaService.walletTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: mockUserId,
            currency: mockCurrency,
            OR: [
              { txHash: { contains: '0x123' } },
              { fromAddress: { contains: '0x123' } },
              { toAddress: { contains: '0x123' } },
              { memo: { contains: '0x123' } },
            ],
          },
        })
      );
    });
  });
});
