import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { FundingRate, FundingInfo } from '../types/perpetual.types';
import { MarketDataService } from '../../market/services/market-data.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class FundingService {
  private readonly logger = new Logger(FundingService.name);
  private readonly FUNDING_KEY_PREFIX = 'funding:rate:';
  private readonly FUNDING_INTERVAL = 8 * 60 * 60; // 8小时
  private readonly MAX_FUNDING_RATE = 0.0075; // 0.75%
  private readonly MIN_FUNDING_RATE = -0.0075; // -0.75%

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly marketDataService: MarketDataService,
  ) {}

  @Cron('0 0 */8 * * *') // 每8小时执行一次
  async calculateAndSettleFunding() {
    const startTime = Date.now();
    try {
      // 获取所有活跃的永续合约
      const perpetualPairs = await this.prisma.perpetualPair.findMany({
        where: { isActive: true },
      });

      for (const pair of perpetualPairs) {
        await this.calculateAndSettlePairFunding(pair.symbol);
      }

      // 记录性能指标
      this.prometheusService.recordLatency('funding_settlement', Date.now() - startTime);
    } catch (error) {
      this.logger.error(`Funding settlement error: ${error.message}`);
      this.prometheusService.incrementErrors('funding_settlement_error');
    }
  }

  private async calculateAndSettlePairFunding(symbol: string) {
    await this.prisma.$transaction(async (prisma) => {
      // 计算资金费率
      const fundingRate = await this.calculateFundingRate(symbol);
      
      // 获取所有持仓
      const positions = await prisma.position.findMany({
        where: {
          symbol,
          amount: { gt: 0 },
        },
      });

      // 结算资金费用
      for (const position of positions) {
        await this.settleFundingFee(prisma, position, fundingRate);
      }

      // 记录资金费率
      await prisma.fundingRate.create({
        data: {
          symbol,
          rate: fundingRate,
          timestamp: new Date(),
        },
      });

      // 更新Redis缓存
      await this.redis.set(
        `${this.FUNDING_KEY_PREFIX}${symbol}`,
        JSON.stringify({
          rate: fundingRate,
          timestamp: Date.now(),
        })
      );

      // 发送资金费率更新事件
      this.eventEmitter.emit('funding.rate.updated', {
        symbol,
        rate: fundingRate,
        timestamp: Date.now(),
      });
    });
  }

  private async calculateFundingRate(symbol: string): Promise<number> {
    try {
      // 获取标记价格和指数价格
      const [markPrice, indexPrice] = await Promise.all([
        this.getMarkPrice(symbol),
        this.getIndexPrice(symbol),
      ]);

      // 计算价格偏离率
      const premium = (markPrice - indexPrice) / indexPrice;

      // 获取利率
      const interestRate = this.configService.get('FUNDING_INTEREST_RATE', 0.0002); // 0.02%

      // 计算资金费率
      let fundingRate = (premium * 3 + interestRate) / this.FUNDING_INTERVAL;

      // 限制在最大和最小范围内
      fundingRate = Math.min(Math.max(fundingRate, this.MIN_FUNDING_RATE), this.MAX_FUNDING_RATE);

      return fundingRate;
    } catch (error) {
      this.logger.error(`Error calculating funding rate: ${error.message}`);
      throw error;
    }
  }

  private async settleFundingFee(
    prisma: any,
    position: any,
    fundingRate: number,
  ): Promise<void> {
    // 计算资金费用
    const positionValue = position.amount * await this.getMarkPrice(position.symbol);
    const fundingFee = positionValue * fundingRate;

    // 多头支付，空头收取
    const fee = position.side === 'LONG' ? fundingFee : -fundingFee;

    // 更新用户余额
    await prisma.userBalance.update({
      where: { userId: position.userId },
      data: {
        balance: {
          decrement: fee,
        },
      },
    });

    // 更新已实现盈亏
    await prisma.position.update({
      where: { id: position.id },
      data: {
        realizedPnl: {
          decrement: fee,
        },
      },
    });

    // 记录资金费用交易
    await prisma.fundingPayment.create({
      data: {
        userId: position.userId,
        symbol: position.symbol,
        positionId: position.id,
        amount: fee,
        rate: fundingRate,
        timestamp: new Date(),
      },
    });
  }

  private async getMarkPrice(symbol: string): Promise<number> {
    const ticker = await this.marketDataService.getTickerData(symbol);
    return ticker.price;
  }

  private async getIndexPrice(symbol: string): Promise<number> {
    // 这里应该实现从多个交易所获取价格并计算指数价格的逻辑
    // 暂时使用标记价格代替
    return this.getMarkPrice(symbol);
  }

  // 公共API方法
  async getFundingRate(symbol: string): Promise<FundingRate> {
    const cached = await this.redis.get(`${this.FUNDING_KEY_PREFIX}${symbol}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const rate = await this.prisma.fundingRate.findFirst({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
    });

    return rate;
  }

  async getFundingHistory(
    symbol: string,
    limit: number = 100,
  ): Promise<FundingRate[]> {
    return await this.prisma.fundingRate.findMany({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getPredictedFundingRate(symbol: string): Promise<number> {
    return await this.calculateFundingRate(symbol);
  }

  async getFundingInfo(symbol: string): Promise<FundingInfo> {
    const [markPrice, indexPrice, lastFundingRate] = await Promise.all([
      this.getMarkPrice(symbol),
      this.getIndexPrice(symbol),
      this.getFundingRate(symbol),
    ]);

    const now = Date.now();
    const nextFundingTime = Math.ceil(now / (this.FUNDING_INTERVAL * 1000)) * (this.FUNDING_INTERVAL * 1000);

    return {
      symbol,
      markPrice,
      indexPrice,
      lastFundingRate: lastFundingRate?.rate || 0,
      nextFundingTime,
      interestRate: this.configService.get('FUNDING_INTEREST_RATE', 0.0002),
    };
  }

  async getUserFundingHistory(
    userId: string,
    symbol?: string,
    limit: number = 100,
  ) {
    return await this.prisma.fundingPayment.findMany({
      where: {
        userId,
        symbol,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }
}
