import { Module } from '@nestjs/common';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { TradeGateway } from './gateways/trade.gateway';
import { OrderMatchingEngine } from './engines/order-matching.engine';
import { AssetModule } from '../asset/asset.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [
    AssetModule,
    PrismaModule,
    RiskModule,
    EventEmitterModule.forRoot(),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        config: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
    }),
  ],
  controllers: [TradeController],
  providers: [
    TradeService,
    TradeGateway,
    OrderMatchingEngine,
  ],
  exports: [TradeService],
})
export class TradeModule {}
