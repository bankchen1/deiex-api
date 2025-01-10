import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisCacheModule } from './modules/redis/redis.module';
import { MarketModule } from './modules/market/market.module';
import { PerpetualModule } from './modules/perpetual/perpetual.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { PrometheusModule } from './modules/prometheus/prometheus.module';
import { TradeModule } from './modules/trade/trade.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisCacheModule,
    MarketModule,
    PerpetualModule,
    StatisticsModule,
    PrometheusModule,
    TradeModule,
    WalletModule,
  ],
})
export class AppModule {}