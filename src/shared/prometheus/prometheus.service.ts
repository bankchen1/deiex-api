import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';
import { ADLStats, LiquidationStats } from '../../modules/liquidation/types/liquidation.types';

@Injectable()
export class PrometheusService {
  // 清算相关指标
  private readonly liquidationCounter: Counter;
  private readonly liquidationVolume: Counter;
  private readonly insuranceFundBalance: Gauge;
  private readonly liquidationFees: Counter;

  // ADL 相关指标
  private readonly adlCounter: Counter;
  private readonly adlVolume: Counter;
  private readonly adlFees: Counter;

  // 交易者相关指标
  private readonly traderProfitRate: Gauge;
  private readonly traderWinRate: Gauge;

  constructor() {
    // 初始化清算指标
    this.liquidationCounter = new Counter({
      name: 'liquidation_total',
      help: 'Total number of liquidations',
      labelNames: ['symbol'],
    });

    this.liquidationVolume = new Counter({
      name: 'liquidation_volume_total',
      help: 'Total volume of liquidations',
      labelNames: ['symbol'],
    });

    this.insuranceFundBalance = new Gauge({
      name: 'insurance_fund_balance',
      help: 'Current balance of insurance fund',
      labelNames: ['symbol'],
    });

    this.liquidationFees = new Counter({
      name: 'liquidation_fees_total',
      help: 'Total liquidation fees collected',
      labelNames: ['symbol'],
    });

    // 初始化 ADL 指标
    this.adlCounter = new Counter({
      name: 'adl_total',
      help: 'Total number of ADL events',
      labelNames: ['symbol'],
    });

    this.adlVolume = new Counter({
      name: 'adl_volume_total',
      help: 'Total volume of ADL',
      labelNames: ['symbol'],
    });

    this.adlFees = new Counter({
      name: 'adl_fees_total',
      help: 'Total ADL fees collected',
      labelNames: ['symbol'],
    });

    // 初始化交易者指标
    this.traderProfitRate = new Gauge({
      name: 'trader_profit_rate',
      help: 'Trader profit rate',
      labelNames: ['traderId'],
    });

    this.traderWinRate = new Gauge({
      name: 'trader_win_rate',
      help: 'Trader win rate',
      labelNames: ['traderId'],
    });
  }

  // 清算相关方法
  incrementLiquidationCount(symbol: string): void {
    this.liquidationCounter.labels(symbol).inc();
  }

  addLiquidationVolume(symbol: string, volume: number): void {
    this.liquidationVolume.labels(symbol).inc(volume);
  }

  setInsuranceFundBalance(symbol: string, balance: number): void {
    this.insuranceFundBalance.labels(symbol).set(balance);
  }

  setLiquidationStats(symbol: string, stats: LiquidationStats): void {
    this.liquidationCounter.labels(symbol).inc(stats.totalLiquidations);
    this.liquidationVolume.labels(symbol).inc(stats.totalLiquidationVolume);
    this.liquidationFees.labels(symbol).inc(stats.totalLiquidationFees);
    this.insuranceFundBalance.labels(symbol).set(stats.insuranceFundBalance);
  }

  // ADL 相关方法
  incrementADLCount(symbol: string): void {
    this.adlCounter.labels(symbol).inc();
  }

  addADLVolume(symbol: string, volume: number): void {
    this.adlVolume.labels(symbol).inc(volume);
  }

  setADLStats(symbol: string, stats: ADLStats): void {
    this.adlCounter.labels(symbol).inc(stats.totalADLs);
    this.adlVolume.labels(symbol).inc(stats.totalADLVolume);
    this.adlFees.labels(symbol).inc(stats.totalADLFees);
  }

  // 交易者相关方法
  setTraderProfitRate(traderId: string, rate: number): void {
    this.traderProfitRate.labels(traderId).set(rate);
  }

  setTraderWinRate(traderId: string, rate: number): void {
    this.traderWinRate.labels(traderId).set(rate);
  }
}
