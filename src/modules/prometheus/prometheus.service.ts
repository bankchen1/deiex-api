import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly registry: Registry;
  private readonly orderCounter: Counter;
  private readonly tradeCounter: Counter;
  private readonly depositCounter: Counter;
  private readonly withdrawCounter: Counter;
  private readonly positionGauge: Gauge;

  constructor() {
    this.registry = new Registry();

    this.orderCounter = new Counter({
      name: 'deiex_orders_total',
      help: 'Total number of orders',
      labelNames: ['side', 'type', 'symbol'],
      registers: [this.registry],
    });

    this.tradeCounter = new Counter({
      name: 'deiex_trades_total',
      help: 'Total number of trades',
      labelNames: ['side', 'symbol'],
      registers: [this.registry],
    });

    this.depositCounter = new Counter({
      name: 'deiex_deposits_total',
      help: 'Total number and amount of deposits',
      labelNames: ['currency', 'amount'],
      registers: [this.registry],
    });

    this.withdrawCounter = new Counter({
      name: 'deiex_withdraws_total',
      help: 'Total number and amount of withdrawals',
      labelNames: ['currency', 'amount'],
      registers: [this.registry],
    });

    this.positionGauge = new Gauge({
      name: 'deiex_positions',
      help: 'Current positions',
      labelNames: ['side', 'symbol'],
      registers: [this.registry],
    });
  }

  incrementOrder(side: string, type: string, symbol: string): void {
    this.orderCounter.inc({ side, type, symbol });
  }

  incrementTrade(side: string, symbol: string): void {
    this.tradeCounter.inc({ side, symbol });
  }

  incrementDeposit(currency: string, amount: string): void {
    this.depositCounter.inc({ currency, amount });
  }

  incrementWithdraw(currency: string, amount: string): void {
    this.withdrawCounter.inc({ currency, amount });
  }

  updatePosition(side: string, symbol: string, value: number): void {
    this.positionGauge.set({ side, symbol }, value);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
} 