import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { PerpetualController } from './perpetual.controller';
import { PerpetualService } from './services/perpetual.service';
import { RiskManagementService } from './services/risk-management.service';
import { ADLService } from './services/adl.service';
import { PrometheusModule } from '../shared/prometheus/prometheus.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisModule, PrometheusModule, PrismaModule],
  controllers: [PerpetualController],
  providers: [PerpetualService, RiskManagementService, ADLService],
  exports: [PerpetualService],
})
export class PerpetualModule {}
