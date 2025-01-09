import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketGateway } from './gateways/market.gateway';
import { DepthService } from './services/depth.service';
import { MarketDataService } from './services/market-data.service';
import { AppRedisModule } from '../../shared/redis/redis.module';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';
import { PrometheusService } from '../../shared/services/prometheus.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    AppRedisModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [MarketController],
  providers: [
    MarketService,
    MarketGateway,
    DepthService,
    MarketDataService,
    RateLimiterService,
    PrometheusService,
  ],
  exports: [MarketService, DepthService, MarketDataService],
})
export class MarketModule {}
