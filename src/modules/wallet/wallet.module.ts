import { Module } from '@nestjs/common';
import { WalletService } from './services/wallet.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { RedisCacheModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, ConfigModule, RedisCacheModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {} 