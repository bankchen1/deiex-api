import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from '../../../shared/services/prometheus.service';
import {
  Position,
  MarginType,
  PerpetualConfig,
  MarginLevel,
  FundingInfo,
} from '../types/perpetual.types';

@Injectable()
export class RiskManagementService {
  private readonly logger = new Logger(RiskManagementService.name);
  private readonly configs = new Map<string, PerpetualConfig>();
  private readonly marginLevels = new Map<string, MarginLevel[]>();
  private readonly fundingInfo = new Map<string, FundingInfo>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {
    this.initializeConfigs();
    this.subscribeToEvents();
  }

  private initializeConfigs(): void {
    try {
      const perpetualConfigs = this.configService.get<PerpetualConfig[]>('perpetual.configs');
      if (!perpetualConfigs) {
        throw new Error('No perpetual configs found');
      }

      for (const config of perpetualConfigs) {
        this.configs.set(config.symbol, config);
      }

      this.logger.log('Risk management configs initialized successfully');
    } catch (error) {
      this.logger.error(
        `Failed to initialize risk management configs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async validateOrder(
    userId: string,
    symbol: string,
    size: number,
    leverage: number,
    marginType: MarginType,
  ): Promise<boolean> {
    try {
      // 获取用户当前仓位
      const position = await this.getPosition(userId, symbol);
      const config = this.getConfig(symbol);

      // 验证杠杆率
      if (leverage > config.maxLeverage) {
        throw new Error(`Leverage exceeds maximum allowed: ${config.maxLeverage}`);
      }

      // 验证订单大小
      if (size < config.minQuantity || size > config.maxQuantity) {
        throw new Error(
          `Order size must be between ${config.minQuantity} and ${config.maxQuantity}`,
        );
      }

      // 验证保证金
      if (marginType === MarginType.ISOLATED) {
        await this.validateIsolatedMargin(position, size, leverage);
      } else {
        await this.validateCrossMargin(userId, position, size, leverage);
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Order validation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async calculateLiquidationPrice(position: Position): Promise<number> {
    try {
      const config = this.getConfig(position.symbol);
      const maintMarginRatio = this.getMaintenanceMarginRatio(
        position.symbol,
        position.leverage,
      );

      if (position.marginType === MarginType.ISOLATED) {
        return this.calculateIsolatedLiquidationPrice(
          position,
          maintMarginRatio,
        );
      } else {
        return this.calculateCrossLiquidationPrice(
          position,
          maintMarginRatio,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to calculate liquidation price: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateFundingRate(symbol: string): Promise<void> {
    try {
      const fundingInfo = this.fundingInfo.get(symbol);
      if (!fundingInfo) {
        throw new Error(`Funding info not found for symbol: ${symbol}`);
      }

      const config = this.getConfig(symbol);
      const markPrice = fundingInfo.markPrice;
      const indexPrice = fundingInfo.indexPrice;

      // 计算资金费率
      const premiumIndex = (markPrice - indexPrice) / indexPrice;
      const fundingRate = this.calculateFundingRate(
        premiumIndex,
        fundingInfo.interestRate,
      );

      // 更新资金费率信息
      fundingInfo.lastFundingRate = fundingRate;
      fundingInfo.nextFundingTime = this.getNextFundingTime(
        config.fundingInterval,
      );

      // 发送资金费率更新事件
      this.eventEmitter.emit('funding.updated', {
        symbol,
        rate: fundingRate,
        timestamp: Date.now(),
      });

      // 更新缓存
      await this.redisService.set(
        `funding:${symbol}`,
        JSON.stringify(fundingInfo),
        config.fundingInterval,
      );

      // 更新指标
      this.prometheusService.setFundingRate(symbol, fundingRate);
    } catch (error) {
      this.logger.error(
        `Failed to update funding rate: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkPositionRisk(position: Position): Promise<void> {
    try {
      const liquidationPrice = await this.calculateLiquidationPrice(position);
      const currentPrice = await this.getCurrentPrice(position.symbol);

      // 检查是否需要强制平仓
      if (this.shouldLiquidate(position, currentPrice, liquidationPrice)) {
        await this.triggerLiquidation(position);
      }

      // 检查是否需要自动减仓
      if (this.shouldReducePosition(position)) {
        await this.triggerADL(position);
      }

      // 更新风险指标
      this.updateRiskMetrics(position, currentPrice, liquidationPrice);
    } catch (error) {
      this.logger.error(
        `Failed to check position risk: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async validateIsolatedMargin(
    position: Position,
    size: number,
    leverage: number,
  ): Promise<void> {
    const config = this.getConfig(position.symbol);
    const requiredMargin = (size * position.entryPrice) / leverage;
    const initialMarginRatio = this.getInitialMarginRatio(
      position.symbol,
      leverage,
    );

    if (position.isolatedMargin! < requiredMargin * (1 + initialMarginRatio)) {
      throw new Error('Insufficient isolated margin');
    }
  }

  private async validateCrossMargin(
    userId: string,
    position: Position,
    size: number,
    leverage: number,
  ): Promise<void> {
    const availableBalance = await this.getAvailableBalance(userId);
    const requiredMargin = (size * position.entryPrice) / leverage;
    const initialMarginRatio = this.getInitialMarginRatio(
      position.symbol,
      leverage,
    );

    if (availableBalance < requiredMargin * (1 + initialMarginRatio)) {
      throw new Error('Insufficient cross margin');
    }
  }

  private calculateIsolatedLiquidationPrice(
    position: Position,
    maintMarginRatio: number,
  ): number {
    const { side, amount, entryPrice, isolatedMargin } = position;
    const bankruptcyPrice =
      side === 'LONG'
        ? entryPrice - isolatedMargin! / amount
        : entryPrice + isolatedMargin! / amount;

    return side === 'LONG'
      ? bankruptcyPrice / (1 - maintMarginRatio)
      : bankruptcyPrice * (1 + maintMarginRatio);
  }

  private calculateCrossLiquidationPrice(
    position: Position,
    maintMarginRatio: number,
  ): number {
    const { side, amount, entryPrice, margin } = position;
    const bankruptcyPrice =
      side === 'LONG'
        ? entryPrice - margin / amount
        : entryPrice + margin / amount;

    return side === 'LONG'
      ? bankruptcyPrice / (1 - maintMarginRatio)
      : bankruptcyPrice * (1 + maintMarginRatio);
  }

  private calculateFundingRate(
    premiumIndex: number,
    interestRate: number,
  ): number {
    // 基于溢价指数和利率计算资金费率
    const maxRate = 0.0075; // 最大资金费率 0.75%
    let fundingRate = premiumIndex + interestRate;

    // 限制资金费率范围
    return Math.max(Math.min(fundingRate, maxRate), -maxRate);
  }

  private getNextFundingTime(interval: number): number {
    const now = Date.now();
    return Math.ceil(now / interval) * interval;
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const price = await this.redisService.get(`price:${symbol}`);
    if (!price) {
      throw new Error(`Price not found for symbol: ${symbol}`);
    }
    return parseFloat(price);
  }

  private shouldLiquidate(
    position: Position,
    currentPrice: number,
    liquidationPrice: number,
  ): boolean {
    return position.side === 'LONG'
      ? currentPrice <= liquidationPrice
      : currentPrice >= liquidationPrice;
  }

  private async triggerLiquidation(position: Position): Promise<void> {
    this.eventEmitter.emit('position.liquidation', position);
    this.prometheusService.incrementLiquidationCount(position.symbol);
  }

  private shouldReducePosition(position: Position): boolean {
    return position.marginRatio < 0.5; // 当保证金率低于50%时触发自动减仓
  }

  private async triggerADL(position: Position): Promise<void> {
    this.eventEmitter.emit('position.adl', position);
    this.prometheusService.incrementADLCount(position.symbol);
  }

  private updateRiskMetrics(
    position: Position,
    currentPrice: number,
    liquidationPrice: number,
  ): void {
    const riskLevel = this.calculateRiskLevel(
      position,
      currentPrice,
      liquidationPrice,
    );
    this.prometheusService.setPositionRiskLevel(
      position.symbol,
      position.userId,
      riskLevel,
    );
  }

  private calculateRiskLevel(
    position: Position,
    currentPrice: number,
    liquidationPrice: number,
  ): number {
    const priceDistance = Math.abs(currentPrice - liquidationPrice);
    const riskPercentage = (priceDistance / currentPrice) * 100;
    return Math.min(Math.max(riskPercentage, 0), 100);
  }

  private getConfig(symbol: string): PerpetualConfig {
    const config = this.configs.get(symbol);
    if (!config) {
      throw new Error(`Config not found for symbol: ${symbol}`);
    }
    return config;
  }

  private async getPosition(
    userId: string,
    symbol: string,
  ): Promise<Position> {
    const position = await this.redisService.get(
      `position:${userId}:${symbol}`,
    );
    if (!position) {
      throw new Error(`Position not found for user ${userId} and symbol ${symbol}`);
    }
    return JSON.parse(position);
  }

  private async getAvailableBalance(userId: string): Promise<number> {
    const balance = await this.redisService.get(`balance:${userId}`);
    if (!balance) {
      throw new Error(`Balance not found for user ${userId}`);
    }
    return parseFloat(balance);
  }

  private getMaintenanceMarginRatio(
    symbol: string,
    leverage: number,
  ): number {
    const levels = this.marginLevels.get(symbol);
    if (!levels) {
      throw new Error(`Margin levels not found for symbol: ${symbol}`);
    }

    const level = levels.find((l) => l.leverage >= leverage);
    return level ? level.maintMarginRatio : levels[0].maintMarginRatio;
  }

  private getInitialMarginRatio(symbol: string, leverage: number): number {
    const levels = this.marginLevels.get(symbol);
    if (!levels) {
      throw new Error(`Margin levels not found for symbol: ${symbol}`);
    }

    const level = levels.find((l) => l.leverage >= leverage);
    return level ? level.initialMarginRatio : levels[0].initialMarginRatio;
  }

  private subscribeToEvents(): void {
    // 监听价格更新事件
    this.eventEmitter.on(
      'price.updated',
      async ({ symbol, price }: { symbol: string; price: number }) => {
        try {
          // 更新价格缓存
          await this.redisService.set(
            `price:${symbol}`,
            price.toString(),
            60, // 1 minute cache
          );

          // 获取所有相关仓位并检查风险
          const positions = await this.getPositionsBySymbol(symbol);
          for (const position of positions) {
            await this.checkPositionRisk(position);
          }
        } catch (error) {
          this.logger.error(
            `Failed to handle price update event: ${error.message}`,
            error.stack,
          );
        }
      },
    );

    // 监听资金费率更新事件
    this.eventEmitter.on(
      'funding.timer',
      async ({ symbol }: { symbol: string }) => {
        try {
          await this.updateFundingRate(symbol);
        } catch (error) {
          this.logger.error(
            `Failed to handle funding timer event: ${error.message}`,
            error.stack,
          );
        }
      },
    );
  }

  private async getPositionsBySymbol(symbol: string): Promise<Position[]> {
    try {
      const keys = await this.redisService.keys(`position:*:${symbol}`);
      const positions: Position[] = [];

      for (const key of keys) {
        const position = await this.redisService.get(key);
        if (position) {
          positions.push(JSON.parse(position));
        }
      }

      return positions;
    } catch (error) {
      this.logger.error(
        `Failed to get positions by symbol: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
