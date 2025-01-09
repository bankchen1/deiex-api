import { Module } from '@nestjs/common';
import { StrategyController } from './strategy.controller';
import { StrategyService } from './strategy.service';
import { StrategyFactory } from './strategy.factory';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [PrismaModule, MarketModule],
  controllers: [StrategyController],
  providers: [StrategyService, StrategyFactory],
  exports: [StrategyService, StrategyFactory],
})
export class StrategyModule {} 