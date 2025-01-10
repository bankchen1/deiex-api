import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientService } from './redis.service';
import { getRedisConfig } from './redis.config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getRedisConfig,
    }),
  ],
  providers: [RedisClientService],
  exports: [RedisClientService],
})
export class RedisCacheModule {}

export { RedisModule };
