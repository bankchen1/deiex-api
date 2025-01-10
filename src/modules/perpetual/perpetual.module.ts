import { Module } from '@nestjs/common';
import { PerpetualService } from './perpetual.service';
import { PerpetualController } from './perpetual.controller';
import { RedisCacheModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [RedisCacheModule, PrismaModule, MarketModule],
  controllers: [PerpetualController],
  providers: [PerpetualService],
  exports: [PerpetualService],
})
export class PerpetualModule {}
