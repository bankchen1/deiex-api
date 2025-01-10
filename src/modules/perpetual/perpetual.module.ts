import { Module } from '@nestjs/common';
import { PerpetualService } from './services/perpetual.service';
import { PerpetualController } from './perpetual.controller';
import { RedisCacheModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketModule } from '../market/market.module';
import { RiskManagementService } from './services/risk-management.service';
import { ADLService } from './services/adl.service';
import { PrometheusModule } from '../prometheus/prometheus.module';

@Module({
  imports: [RedisCacheModule, PrismaModule, MarketModule, PrometheusModule],
  controllers: [PerpetualController],
  providers: [PerpetualService, RiskManagementService, ADLService],
  exports: [PerpetualService],
})
export class PerpetualModule {}
