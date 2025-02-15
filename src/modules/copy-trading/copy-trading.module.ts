import { Module } from '@nestjs/common';
import { CopyTradingService } from './services/copy-trading.service';
import { CopyTradingController } from './controllers/copy-trading.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppRedisModule } from '../redis/redis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '../shared/prometheus/prometheus.module';

@Module({
  imports: [
    PrismaModule,
    AppRedisModule,
    ConfigModule,
    PrometheusModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [CopyTradingController],
  providers: [CopyTradingService],
  exports: [CopyTradingService],
})
export class CopyTradingModule {}
