import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './services/statistics.service';
import { RedisCacheModule } from '../redis/redis.module';
import { TradeModule } from '../trade/trade.module';

@Module({
  imports: [RedisCacheModule, TradeModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
