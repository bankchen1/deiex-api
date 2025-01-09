import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './services/statistics.service';
import { TradeModule } from '../trade/trade.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TradeModule, UserModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
