import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MarketModule } from './modules/market/market.module';
import { PerpetualModule } from './modules/perpetual/perpetual.module';
import { RedisModule } from './modules/redis/redis.module';
import { PrometheusModule } from './modules/shared/prometheus/prometheus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    MarketModule,
    PerpetualModule,
    RedisModule,
    PrometheusModule,
  ],
})
export class AppModule {}