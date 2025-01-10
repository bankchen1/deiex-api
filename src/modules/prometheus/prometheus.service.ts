import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly latencyHistogram: Histogram;
  private readonly errorCounter: Counter;
  private readonly tradeGauge: Gauge;

  constructor() {
    this.latencyHistogram = new Histogram({
      name: 'api_latency_seconds',
      help: 'API latency in seconds',
      labelNames: ['operation'],
    });

    this.errorCounter = new Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['operation'],
    });

    this.tradeGauge = new Gauge({
      name: 'trade_volume',
      help: 'Trading volume',
      labelNames: ['symbol'],
    });
  }

  recordLatency(operation: string, latencyMs: number): void {
    this.latencyHistogram.labels(operation).observe(latencyMs / 1000);
  }

  incrementErrors(operation: string): void {
    this.errorCounter.labels(operation).inc();
  }

  setTradeVolume(symbol: string, volume: number): void {
    this.tradeGauge.labels(symbol).set(volume);
  }
} 