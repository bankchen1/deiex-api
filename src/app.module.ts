import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisCacheModule } from './modules/redis/redis.module';
import { MarketModule } from './modules/market/market.module';
import { PerpetualModule } from './modules/perpetual/perpetual.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { PrometheusModule } from './modules/prometheus/prometheus.module';
import { TradeModule } from './modules/trade/trade.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisCacheModule,
    MarketModule,
    PerpetualModule,
    StatisticsModule,
    PrometheusModule,
    TradeModule,
  ],
})
export class AppModule {}