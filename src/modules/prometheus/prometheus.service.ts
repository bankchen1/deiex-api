import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';
import { RedisClientService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrometheusService {
  private readonly registry: Registry;
  private readonly orderCounter: Counter;
  private readonly tradeCounter: Counter;
  private readonly positionGauge: Gauge;
  private readonly balanceGauge: Gauge;

  constructor(
    private readonly redis: RedisClientService,
    private readonly prisma: PrismaService,
  ) {
    this.registry = new Registry();

    this.orderCounter = new Counter({
      name: 'deiex_orders_total',
      help: 'Total number of orders',
      labelNames: ['symbol', 'side', 'type'],
      registers: [this.registry],
    });

    this.tradeCounter = new Counter({
      name: 'deiex_trades_total',
      help: 'Total number of trades',
      labelNames: ['symbol', 'side'],
      registers: [this.registry],
    });

    this.positionGauge = new Gauge({
      name: 'deiex_positions',
      help: 'Current positions',
      labelNames: ['symbol', 'side'],
      registers: [this.registry],
    });

    this.balanceGauge = new Gauge({
      name: 'deiex_balances',
      help: 'Current balances',
      labelNames: ['currency'],
      registers: [this.registry],
    });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  incrementOrderCounter(symbol: string, side: string, type: string): void {
    this.orderCounter.labels(symbol, side, type).inc();
  }

  incrementTradeCounter(symbol: string, side: string): void {
    this.tradeCounter.labels(symbol, side).inc();
  }

  async updatePositionGauge(symbol: string, side: string, value: number): Promise<void> {
    this.positionGauge.labels(symbol, side).set(value);
  }

  async updateBalanceGauge(currency: string, value: number): Promise<void> {
    this.balanceGauge.labels(currency).set(value);
  }

  async collectMetrics(): Promise<void> {
    // 收集持仓数据
    const positions = await this.prisma.$queryRaw<Array<{
      symbol: string;
      side: string;
      total_quantity: string;
    }>>`
      SELECT symbol, side, SUM(quantity) as total_quantity
      FROM "Position"
      GROUP BY symbol, side
    `;

    for (const position of positions) {
      if (position.total_quantity) {
        this.positionGauge
          .labels(position.symbol, position.side)
          .set(parseFloat(position.total_quantity));
      }
    }

    // 收集余额数据
    const balances = await this.prisma.$queryRaw<Array<{
      currency: string;
      total_available: string;
      total_locked: string;
    }>>`
      SELECT currency, SUM(available) as total_available, SUM(locked) as total_locked
      FROM "Balance"
      GROUP BY currency
    `;

    for (const balance of balances) {
      const total = parseFloat(balance.total_available) + parseFloat(balance.total_locked);
      this.balanceGauge.labels(balance.currency).set(total);
    }
  }
} 