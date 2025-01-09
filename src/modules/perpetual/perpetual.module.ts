import { Module } from '@nestjs/common';
import { PerpetualService } from './perpetual.service';
import { PerpetualController } from './perpetual.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [PerpetualController],
  providers: [PerpetualService],
  exports: [PerpetualService],
})
export class PerpetualModule {}
