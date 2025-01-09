import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '../redis/redis.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketGateway } from './gateways/market.gateway';
import { DepthService } from './services/depth.service';
import { PrometheusService } from '../../shared/services/prometheus.service';

@Module({
  imports: [
    RedisModule,
    ConfigModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [MarketController],
  providers: [
    MarketService,
    MarketGateway,
    DepthService,
    PrometheusService,
  ],
  exports: [MarketService],
})
export class MarketModule {}
