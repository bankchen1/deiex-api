import { Injectable } from '@nestjs/common';
import { Registry, Counter, Gauge, Histogram } from 'prom-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrometheusService {
  private readonly registry: Registry;
  
  // 连接数指标
  private readonly connectionsGauge: Gauge<string>;
  
  // 订阅计数器
  private readonly subscriptionsCounter: Counter<string>;
  
  // 广播计数器
  private readonly broadcastsCounter: Counter<string>;
  
  // 错误计数器
  private readonly errorsCounter: Counter<string>;
  
  // 延迟直方图
  private readonly latencyHistogram: Histogram<string>;
  
  // 订单处理指标
  private readonly orderProcessingGauge: Gauge<string>;
  private readonly orderProcessingHistogram: Histogram<string>;
  
  // 系统资源指标
  private readonly memoryGauge: Gauge<string>;
  private readonly cpuGauge: Gauge<string>;

  constructor(private readonly configService: ConfigService) {
    this.registry = new Registry();
    
    // 初始化指标
    this.connectionsGauge = new Gauge({
      name: 'ws_connections_total',
      help: 'Total number of WebSocket connections',
      registers: [this.registry],
    });

    this.subscriptionsCounter = new Counter({
      name: 'ws_subscriptions_total',
      help: 'Total number of WebSocket subscriptions',
      labelNames: ['symbol', 'channel'],
      registers: [this.registry],
    });

    this.broadcastsCounter = new Counter({
      name: 'ws_broadcasts_total',
      help: 'Total number of WebSocket broadcasts',
      labelNames: ['channel'],
      registers: [this.registry],
    });

    this.errorsCounter = new Counter({
      name: 'ws_errors_total',
      help: 'Total number of WebSocket errors',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.latencyHistogram = new Histogram({
      name: 'ws_operation_latency',
      help: 'Latency of WebSocket operations',
      labelNames: ['operation'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    this.orderProcessingGauge = new Gauge({
      name: 'order_processing_current',
      help: 'Current number of orders being processed',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.orderProcessingHistogram = new Histogram({
      name: 'order_processing_duration',
      help: 'Duration of order processing',
      labelNames: ['type'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.memoryGauge = new Gauge({
      name: 'system_memory_usage',
      help: 'System memory usage',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.cpuGauge = new Gauge({
      name: 'system_cpu_usage',
      help: 'System CPU usage',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // 启动系统资源监控
    this.startResourceMonitoring();
  }

  // WebSocket连接指标
  incrementConnections(): void {
    this.connectionsGauge.inc();
  }

  decrementConnections(): void {
    this.connectionsGauge.dec();
  }

  // 订阅指标
  recordSubscription(symbol: string, channel: string): void {
    this.subscriptionsCounter.inc({ symbol, channel });
  }

  // 广播指标
  incrementBroadcasts(channel: string): void {
    this.broadcastsCounter.inc({ channel });
  }

  // 错误指标
  incrementErrors(type: string): void {
    this.errorsCounter.inc({ type });
  }

  // 延迟指标
  recordLatency(operation: string, duration: number): void {
    this.latencyHistogram.observe({ operation }, duration);
  }

  // 订单处理指标
  startOrderProcessing(type: string): void {
    this.orderProcessingGauge.inc({ type });
  }

  endOrderProcessing(type: string, duration: number): void {
    this.orderProcessingGauge.dec({ type });
    this.orderProcessingHistogram.observe({ type }, duration);
  }

  // 系统资源监控
  private startResourceMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      
      // 记录内存使用情况
      this.memoryGauge.set({ type: 'heapTotal' }, usage.heapTotal);
      this.memoryGauge.set({ type: 'heapUsed' }, usage.heapUsed);
      this.memoryGauge.set({ type: 'rss' }, usage.rss);
      
      // 记录CPU使用情况
      const cpuUsage = process.cpuUsage();
      this.cpuGauge.set({ type: 'user' }, cpuUsage.user);
      this.cpuGauge.set({ type: 'system' }, cpuUsage.system);
    }, 5000); // 每5秒更新一次
  }

  // 获取所有指标
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  // 重置所有指标
  async resetMetrics(): Promise<void> {
    return await this.registry.resetMetrics();
  }

  // 清除所有指标
  async clearMetrics(): Promise<void> {
    return await this.registry.clear();
  }
}
