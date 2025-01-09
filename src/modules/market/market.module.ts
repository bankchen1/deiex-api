import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
