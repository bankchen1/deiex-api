import { Injectable } from '@nestjs/common';
import IORedis, { Redis, ChainableCommander } from 'ioredis';
import { RedisService as NestRedisService } from '@liaoliaots/nestjs-redis';

@Injectable()
export class RedisService {
  private readonly redis: Redis;

  constructor(private readonly redisService: NestRedisService) {
    this.redis = this.redisService.getClient();
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(key, value, 'EX', ttl);
    } else {
      await this.redis.set(key, value);
    }
  }

  async setNX(key: string, value: string, ttl?: number): Promise<boolean> {
    if (ttl) {
      const result = await this.redis.set(key, value, 'EX', ttl, 'NX');
      return result === 'OK';
    } else {
      const result = await this.redis.set(key, value, 'NX');
      return result === 'OK';
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redis.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return await this.redis.ttl(key);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return await this.redis.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.redis.hset(key, field, value);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.redis.hdel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return await this.redis.hgetall(key);
  }

  multi(): ChainableCommander {
    return this.redis.multi();
  }

  async watch(key: string): Promise<void> {
    await this.redis.watch(key);
  }

  async unwatch(): Promise<void> {
    await this.redis.unwatch();
  }

  getClient(): Redis {
    return this.redis;
  }
}
