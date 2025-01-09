import { Module } from '@nestjs/common';
import { CopyTradingController } from './copy-trading.controller';
import { CopyTradingService } from './copy-trading.service';
import { CopyTradingGateway } from './gateways/copy-trading.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { TradeModule } from '../trade/trade.module';

@Module({
  imports: [PrismaModule, TradeModule],
  controllers: [CopyTradingController],
  providers: [CopyTradingService, CopyTradingGateway],
  exports: [CopyTradingService],
})
export class CopyTradingModule {}
