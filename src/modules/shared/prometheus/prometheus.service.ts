import { Injectable } from '@nestjs/common';
import { Counter, Gauge, register } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly orderCount: Counter;
  private readonly traderCount: Gauge;
  private readonly positionRiskLevel: Gauge;
  private readonly orderProcessingTime: Gauge;

  constructor() {
    this.orderCount = new Counter({
      name: 'deiex_order_count',
      help: 'Total number of orders',
      labelNames: ['symbol', 'side', 'type'],
    });

    this.traderCount = new Gauge({
      name: 'deiex_trader_count',
      help: 'Number of active traders',
    });

    this.positionRiskLevel = new Gauge({
      name: 'deiex_position_risk_level',
      help: 'Risk level of positions',
      labelNames: ['symbol', 'side'],
    });

    this.orderProcessingTime = new Gauge({
      name: 'deiex_order_processing_time',
      help: 'Time taken to process orders in milliseconds',
      labelNames: ['symbol', 'type'],
    });
  }

  incrementOrderCount(symbol: string, side: string, type: string): void {
    this.orderCount.inc({ symbol, side, type });
  }

  setTraderCount(count: number): void {
    this.traderCount.set(count);
  }

  setPositionRiskLevel(symbol: string, side: string, level: number): void {
    this.positionRiskLevel.set({ symbol, side }, level);
  }

  setOrderProcessingTime(symbol: string, type: string, time: number): void {
    this.orderProcessingTime.set({ symbol, type }, time);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
} 