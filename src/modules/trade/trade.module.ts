import { Module } from '@nestjs/common';
import { TradeService } from './trade.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AssetModule } from '../asset/asset.module';
import { RiskModule } from '../risk/risk.module';
import { PrometheusModule } from '../prometheus/prometheus.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AssetModule,
    RiskModule,
    PrometheusModule,
  ],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
