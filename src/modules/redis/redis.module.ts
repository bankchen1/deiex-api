import { Module } from '@nestjs/common';
import { redisProvider, REDIS_CLIENT } from './redis.provider';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
