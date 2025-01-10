import { Module } from '@nestjs/common';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { PrismaModule } from '../../modules/prisma/prisma.module';
import { PrometheusModule } from '../../modules/prometheus/prometheus.module';
import { RedisCacheModule } from '../../modules/redis/redis.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    PrometheusModule,
    RedisCacheModule,
    ConfigModule,
  ],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}
