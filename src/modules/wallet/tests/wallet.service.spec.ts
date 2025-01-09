import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../services/wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { Web3Service } from '../services/web3.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { 
  WalletStatus,
  TransactionType,
  TransactionStatus,
} from '../types/wallet.types';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('WalletService', () => {
  let service: WalletService;
  let prismaService: DeepMockProxy<PrismaService>;
  let web3Service: DeepMockProxy<Web3Service>;

  const mockUserId = 'user-123';
  const mockCurrency = 'BTC';
  const mockAddress = '0x123...';

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
        WalletService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'WITHDRAWAL_DAILY_LIMIT_BTC':
                  return 1;
                case 'WITHDRAWAL_MONTHLY_LIMIT_BTC':
                  return 10;
                default:
                  return null;
              }
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: PrometheusService,
          useValue: {
            recordLatency: jest.fn(),
            incrementErrors: jest.fn(),
          },
        },
        {
          provide: Web3Service,
          useValue: mockDeep<Web3Service>(),
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prismaService = module.get(PrismaService);
    web3Service = module.get(Web3Service);
  });

  describe('createWallet', () => {
    it('should create a new wallet successfully', async () => {
      // Mock dependencies
      web3Service.generateAddress.mockResolvedValue(mockAddress);
      prismaService.wallet.findFirst.mockResolvedValue(null);
      prismaService.wallet.create.mockResolvedValue({
        id: 'wallet-123',
        userId: mockUserId,
        currency: mockCurrency,
        address: mockAddress,
        balance: 0,
        frozenBalance: 0,
        totalDeposit: 0,
        totalWithdraw: 0,
        status: WalletStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute test
      const result = await service.createWallet(mockUserId, mockCurrency);

      // Verify results
      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.currency).toBe(mockCurrency);
      expect(result.address).toBe(mockAddress);
      expect(result.balance).toBe(0);
      expect(result.status).toBe(WalletStatus.ACTIVE);

      // Verify interactions
      expect(web3Service.generateAddress).toHaveBeenCalledWith(expect.any(String));
      expect(prismaService.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          currency: mockCurrency,
          address: mockAddress,
        }),
      });
    });

    it('should throw error if wallet already exists', async () => {
      // Mock existing wallet
      prismaService.wallet.findFirst.mockResolvedValue({
        id: 'wallet-123',
        userId: mockUserId,
        currency: mockCurrency,
        address: mockAddress,
        balance: 0,
        frozenBalance: 0,
        totalDeposit: 0,
        totalWithdraw: 0,
        status: WalletStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute and verify
      await expect(service.createWallet(mockUserId, mockCurrency))
        .rejects
        .toThrow('Wallet for BTC already exists');
    });
  });

  describe('updateBalance', () => {
    const mockWalletId = 'wallet-123';
    const mockAmount = 1.5;

    it('should update balance successfully', async () => {
      // Mock wallet
      prismaService.wallet.findUnique.mockResolvedValue({
        id: mockWalletId,
        userId: mockUserId,
        currency: mockCurrency,
        address: mockAddress,
        balance: 1,
        frozenBalance: 0,
        totalDeposit: 1,
        totalWithdraw: 0,
        status: WalletStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock update
      prismaService.wallet.update.mockResolvedValue({
        id: mockWalletId,
        balance: 2.5,
        updatedAt: new Date(),
      } as any);

      // Execute test
      const result = await service.updateBalance(
        mockWalletId,
        mockAmount,
        TransactionType.DEPOSIT
      );

      // Verify results
      expect(result).toBeDefined();
      expect(result.balance).toBe(2.5);

      // Verify interactions
      expect(prismaService.wallet.update).toHaveBeenCalledWith({
        where: { id: mockWalletId },
        data: expect.objectContaining({
          balance: { increment: mockAmount },
        }),
      });
    });

    it('should throw error if insufficient balance for debit', async () => {
      // Mock wallet with low balance
      prismaService.wallet.findUnique.mockResolvedValue({
        id: mockWalletId,
        balance: 1,
        status: WalletStatus.ACTIVE,
      } as any);

      // Execute and verify
      await expect(service.updateBalance(
        mockWalletId,
        -2,
        TransactionType.WITHDRAW
      )).rejects.toThrow('Insufficient balance');
    });
  });

  describe('freezeBalance', () => {
    const mockWalletId = 'wallet-123';
    const mockAmount = 1;

    it('should freeze balance successfully', async () => {
      // Mock wallet
      prismaService.wallet.findUnique.mockResolvedValue({
        id: mockWalletId,
        balance: 2,
        frozenBalance: 0,
      } as any);

      // Mock update
      prismaService.wallet.update.mockResolvedValue({
        id: mockWalletId,
        balance: 1,
        frozenBalance: 1,
      } as any);

      // Execute test
      const result = await service.freezeBalance(mockWalletId, mockAmount);

      // Verify results
      expect(result).toBeDefined();
      expect(result.balance).toBe(1);
      expect(result.frozenBalance).toBe(1);

      // Verify interactions
      expect(prismaService.wallet.update).toHaveBeenCalledWith({
        where: { id: mockWalletId },
        data: expect.objectContaining({
          balance: { decrement: mockAmount },
          frozenBalance: { increment: mockAmount },
        }),
      });
    });

    it('should throw error if insufficient balance to freeze', async () => {
      // Mock wallet with low balance
      prismaService.wallet.findUnique.mockResolvedValue({
        id: mockWalletId,
        balance: 0.5,
        frozenBalance: 0,
      } as any);

      // Execute and verify
      await expect(service.freezeBalance(mockWalletId, 1))
        .rejects
        .toThrow('Insufficient balance to freeze');
    });
  });

  describe('getWallet', () => {
    it('should return wallet if exists', async () => {
      // Mock wallet
      const mockWallet = {
        id: 'wallet-123',
        userId: mockUserId,
        currency: mockCurrency,
        balance: 1,
      };
      prismaService.wallet.findFirst.mockResolvedValue(mockWallet as any);

      // Execute test
      const result = await service.getWallet(mockUserId, mockCurrency);

      // Verify results
      expect(result).toBeDefined();
      expect(result).toEqual(mockWallet);

      // Verify interactions
      expect(prismaService.wallet.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, currency: mockCurrency },
      });
    });

    it('should return null if wallet does not exist', async () => {
      // Mock no wallet found
      prismaService.wallet.findFirst.mockResolvedValue(null);

      // Execute test
      const result = await service.getWallet(mockUserId, mockCurrency);

      // Verify results
      expect(result).toBeNull();
    });
  });
});
