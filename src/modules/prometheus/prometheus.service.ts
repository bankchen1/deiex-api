import { Injectable } from '@nestjs/common';
import { Counter, Registry, Gauge } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly registry: Registry;
  private readonly orderCounter: Counter;
  private readonly tradeCounter: Counter;
  private readonly positionGauge: Gauge;

  constructor() {
    this.registry = new Registry();
    
    // 订单计数器
    this.orderCounter = new Counter({
      name: 'deiex_orders_total',
      help: '订单总数',
      labelNames: ['type', 'status'],
    });

    // 交易计数器
    this.tradeCounter = new Counter({
      name: 'deiex_trades_total',
      help: '交易总数',
      labelNames: ['symbol', 'side'],
    });

    // 持仓量表
    this.positionGauge = new Gauge({
      name: 'deiex_positions',
      help: '当前持仓量',
      labelNames: ['symbol', 'side'],
    });

    // 注册指标
    this.registry.registerMetric(this.orderCounter);
    this.registry.registerMetric(this.tradeCounter);
    this.registry.registerMetric(this.positionGauge);
  }

  // 增加订单计数
  incrementOrderCounter(type: string, status: string): void {
    this.orderCounter.inc({ type, status });
  }

  // 增加交易计数
  incrementTradeCounter(symbol: string, side: string): void {
    this.tradeCounter.inc({ symbol, side });
  }

  // 更新持仓量
  updatePosition(symbol: string, side: string, value: number): void {
    this.positionGauge.set({ symbol, side }, value);
  }

  // 获取所有指标
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
} 