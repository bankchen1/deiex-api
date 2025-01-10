import { Module } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { RedisCacheModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisCacheModule, PrismaModule],
  providers: [PrometheusService],
  exports: [PrometheusService],
})
export class PrometheusModule {} 