import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly wsConnections: Gauge;
  private readonly subscriptions: Gauge;
  private readonly messagesSent: Counter;
  private readonly messageLatency: Histogram;
  private readonly klineUpdates: Counter;
  private readonly tickerUpdates: Counter;
  private readonly errors: Counter;

  constructor() {
    // WebSocket连接数
    this.wsConnections = new Gauge({
      name: 'websocket_connections',
      help: 'Number of active WebSocket connections',
    });

    // 订阅数
    this.subscriptions = new Gauge({
      name: 'websocket_subscriptions',
      help: 'Number of active channel subscriptions',
      labelNames: ['channel'],
    });

    // 消息发送计数器
    this.messagesSent = new Counter({
      name: 'websocket_messages_sent',
      help: 'Number of messages sent through WebSocket',
      labelNames: ['channel'],
    });

    // 消息延迟直方图
    this.messageLatency = new Histogram({
      name: 'websocket_message_latency',
      help: 'Latency of WebSocket messages in milliseconds',
      labelNames: ['channel'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
    });

    // K线更新计数器
    this.klineUpdates = new Counter({
      name: 'kline_updates_total',
      help: 'Total number of kline updates',
      labelNames: ['symbol', 'interval'],
    });

    // Ticker更新计数器
    this.tickerUpdates = new Counter({
      name: 'ticker_updates_total',
      help: 'Total number of ticker updates',
      labelNames: ['symbol'],
    });

    // 错误计数器
    this.errors = new Counter({
      name: 'market_errors_total',
      help: 'Total number of market errors',
      labelNames: ['type'],
    });
  }

  // WebSocket连接计数
  incrementWebSocketConnections(): void {
    this.wsConnections.inc();
  }

  decrementWebSocketConnections(): void {
    this.wsConnections.dec();
  }

  // 订阅计数
  incrementSubscriptions(channel: string): void {
    this.subscriptions.inc({ channel });
  }

  decrementSubscriptions(channel: string): void {
    this.subscriptions.dec({ channel });
  }

  // 消息发送计数
  incrementMessagesSent(channel: string): void {
    this.messagesSent.inc({ channel });
  }

  // 记录消息延迟
  observeMessageLatency(channel: string, latency: number): void {
    this.messageLatency.observe({ channel }, latency);
  }

  // K线更新计数
  incrementKlineUpdates(symbol: string, interval: string): void {
    this.klineUpdates.inc({ symbol, interval });
  }

  // Ticker更新计数
  incrementTickerUpdates(symbol: string): void {
    this.tickerUpdates.inc({ symbol });
  }

  // 错误计数
  incrementErrors(type: string): void {
    this.errors.inc({ type });
  }
}
