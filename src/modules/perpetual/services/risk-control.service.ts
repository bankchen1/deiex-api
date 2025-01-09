import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { PerpetualOrder, Position, PositionSide, MarginType } from '../types/perpetual.types';
import { MarketDataService } from '../../market/services/market-data.service';

@Injectable()
export class RiskControlService {
  private readonly logger = new Logger(RiskControlService.name);
  private readonly RISK_LIMIT_PREFIX = 'risk:limit:';
  private readonly PRICE_LIMIT_PREFIX = 'price:limit:';
  private readonly ORDER_LIMIT_PREFIX = 'order:limit:';

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
    private readonly marketDataService: MarketDataService,
  ) {
    this.initializeRiskLimits();
  }

  private async initializeRiskLimits() {
    // 从配置或数据库加载风险限制参数
    const pairs = await this.prisma.perpetualPair.findMany({
      where: { isActive: true },
    });

    for (const pair of pairs) {
      await this.updateRiskLimits(pair.symbol);
    }
  }

  private async updateRiskLimits(symbol: string) {
    const limits = {
      maxPositionSize: this.configService.get(`RISK_MAX_POSITION_${symbol}`, 1000000),
      maxLeverage: this.configService.get(`RISK_MAX_LEVERAGE_${symbol}`, 100),
      maxDailyOrders: this.configService.get(`RISK_MAX_DAILY_ORDERS_${symbol}`, 1000),
      priceDeviation: this.configService.get(`RISK_PRICE_DEVIATION_${symbol}`, 0.1), // 10%
      minOrderInterval: this.configService.get(`RISK_MIN_ORDER_INTERVAL_${symbol}`, 100), // ms
    };

    await this.redis.set(
      `${this.RISK_LIMIT_PREFIX}${symbol}`,
      JSON.stringify(limits),
      'EX',
      86400
    );
  }

  // 持仓限制检查
  async checkPositionLimit(
    userId: string,
    symbol: string,
    amount: number,
    leverage: number
  ): Promise<boolean> {
    const startTime = Date.now();
    try {
      // 获取风险限制参数
      const limits = JSON.parse(
        await this.redis.get(`${this.RISK_LIMIT_PREFIX}${symbol}`) || '{}'
      );

      // 检查杠杆倍数
      if (leverage > limits.maxLeverage) {
        throw new Error(`Leverage exceeds maximum limit of ${limits.maxLeverage}`);
      }

      // 检查持仓规模
      const position = await this.prisma.position.findFirst({
        where: { userId, symbol },
      });

      const totalPosition = (position?.amount || 0) + amount;
      if (totalPosition > limits.maxPositionSize) {
        throw new Error(`Position size exceeds maximum limit of ${limits.maxPositionSize}`);
      }

      // 记录性能指标
      this.prometheusService.recordLatency('risk_position_check', Date.now() - startTime);
      return true;
    } catch (error) {
      this.logger.error(`Position limit check error: ${error.message}`);
      this.prometheusService.incrementErrors('risk_position_check_error');
      throw error;
    }
  }

  // 价格限制检查
  async checkPriceLimit(symbol: string, price: number): Promise<boolean> {
    const startTime = Date.now();
    try {
      const limits = JSON.parse(
        await this.redis.get(`${this.RISK_LIMIT_PREFIX}${symbol}`) || '{}'
      );

      // 获取指数价格
      const indexPrice = await this.marketDataService.getIndexPrice(symbol);

      // 计算价格偏离度
      const deviation = Math.abs(price - indexPrice) / indexPrice;
      if (deviation > limits.priceDeviation) {
        throw new Error(`Price deviation exceeds maximum limit of ${limits.priceDeviation * 100}%`);
      }

      this.prometheusService.recordLatency('risk_price_check', Date.now() - startTime);
      return true;
    } catch (error) {
      this.logger.error(`Price limit check error: ${error.message}`);
      this.prometheusService.incrementErrors('risk_price_check_error');
      throw error;
    }
  }

  // 订单限制检查
  async checkOrderLimit(userId: string, symbol: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      const limits = JSON.parse(
        await this.redis.get(`${this.RISK_LIMIT_PREFIX}${symbol}`) || '{}'
      );

      // 检查订单频率
      const lastOrderTime = await this.redis.get(`${this.ORDER_LIMIT_PREFIX}${userId}:${symbol}`);
      if (lastOrderTime) {
        const timeDiff = Date.now() - parseInt(lastOrderTime);
        if (timeDiff < limits.minOrderInterval) {
          throw new Error(`Order frequency exceeds limit. Please wait ${limits.minOrderInterval - timeDiff}ms`);
        }
      }

      // 检查每日订单数量
      const dailyOrders = await this.prisma.perpetualOrder.count({
        where: {
          userId,
          symbol,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (dailyOrders >= limits.maxDailyOrders) {
        throw new Error(`Daily order count exceeds maximum limit of ${limits.maxDailyOrders}`);
      }

      // 更新最后下单时间
      await this.redis.set(
        `${this.ORDER_LIMIT_PREFIX}${userId}:${symbol}`,
        Date.now(),
        'EX',
        60
      );

      this.prometheusService.recordLatency('risk_order_check', Date.now() - startTime);
      return true;
    } catch (error) {
      this.logger.error(`Order limit check error: ${error.message}`);
      this.prometheusService.incrementErrors('risk_order_check_error');
      throw error;
    }
  }

  // 风险预警系统
  async checkSystemRisk(symbol: string): Promise<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    warnings: string[];
  }> {
    const startTime = Date.now();
    try {
      const warnings: string[] = [];
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

      // 检查保险基金余额
      const insuranceFund = await this.prisma.insuranceFund.findUnique({
        where: { symbol },
      });

      if (insuranceFund.balance < insuranceFund.totalPayouts * 0.1) {
        warnings.push('Insurance fund balance is critically low');
        riskLevel = 'HIGH';
      } else if (insuranceFund.balance < insuranceFund.totalPayouts * 0.3) {
        warnings.push('Insurance fund balance is low');
        riskLevel = 'MEDIUM';
      }

      // 检查未实现损益
      const positions = await this.prisma.position.findMany({
        where: { symbol },
      });

      let totalUnrealizedPnl = 0;
      for (const position of positions) {
        totalUnrealizedPnl += position.unrealizedPnl;
      }

      if (Math.abs(totalUnrealizedPnl) > insuranceFund.balance) {
        warnings.push('Total unrealized PnL exceeds insurance fund balance');
        riskLevel = 'HIGH';
      }

      // 检查价格波动
      const recentPrices = await this.marketDataService.getRecentPrices(symbol, 60); // 最近60分钟
      const volatility = this.calculateVolatility(recentPrices);
      
      if (volatility > 0.1) { // 10%
        warnings.push('High price volatility detected');
        riskLevel = Math.max(riskLevel === 'HIGH' ? 2 : riskLevel === 'MEDIUM' ? 1 : 0, 1) as any;
      }

      this.prometheusService.recordLatency('risk_system_check', Date.now() - startTime);

      // 发送风险预警事件
      if (warnings.length > 0) {
        this.eventEmitter.emit('risk.warning', {
          symbol,
          riskLevel,
          warnings,
          timestamp: Date.now(),
        });
      }

      return { riskLevel, warnings };
    } catch (error) {
      this.logger.error(`System risk check error: ${error.message}`);
      this.prometheusService.incrementErrors('risk_system_check_error');
      throw error;
    }
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // 公共API方法
  async getRiskLimits(symbol: string) {
    return JSON.parse(
      await this.redis.get(`${this.RISK_LIMIT_PREFIX}${symbol}`) || '{}'
    );
  }

  async getUserRiskMetrics(userId: string, symbol: string) {
    const position = await this.prisma.position.findFirst({
      where: { userId, symbol },
    });

    if (!position) {
      return {
        positionRisk: 0,
        leverageRisk: 0,
        marginRatio: 0,
        warningLevel: 'SAFE',
      };
    }

    const marginRatio = position.marginRatio;
    let warningLevel = 'SAFE';
    
    if (marginRatio < 0.1) {
      warningLevel = 'DANGER';
    } else if (marginRatio < 0.2) {
      warningLevel = 'WARNING';
    }

    return {
      positionRisk: position.amount / (await this.getRiskLimits(symbol)).maxPositionSize,
      leverageRisk: position.leverage / (await this.getRiskLimits(symbol)).maxLeverage,
      marginRatio,
      warningLevel,
    };
  }
}
