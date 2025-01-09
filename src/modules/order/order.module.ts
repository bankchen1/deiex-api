import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ConfigModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
