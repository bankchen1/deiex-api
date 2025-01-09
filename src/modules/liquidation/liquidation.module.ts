import { Module } from '@nestjs/common';
import { LiquidationService } from './services/liquidation.service';
import { ADLService } from './services/adl.service';
import { AppRedisModule } from '../redis/redis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '../shared/prometheus/prometheus.module';

@Module({
  imports: [
    AppRedisModule,
    ConfigModule,
    PrometheusModule,
    EventEmitterModule.forRoot(),
  ],
  providers: [LiquidationService, ADLService],
  exports: [LiquidationService, ADLService],
})
export class LiquidationModule {}
