import { Module } from '@nestjs/common';
import { RiskService } from './risk.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetModule } from '../asset/asset.module';

@Module({
  imports: [PrismaModule, AssetModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
