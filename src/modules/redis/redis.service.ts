import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT, RedisClient } from './redis.types';

@Injectable()
export class RedisService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.redis.set(key, value, 'EX', ttl);
    }
    return this.redis.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.redis.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.redis.hset(key, field, value);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.redis.hdel(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.redis.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number, withScores = false): Promise<string[]> {
    if (withScores) {
      return this.redis.zrange(key, start, stop, 'WITHSCORES');
    }
    return this.redis.zrange(key, start, stop);
  }

  async zrevrange(key: string, start: number, stop: number, withScores = false): Promise<string[]> {
    if (withScores) {
      return this.redis.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return this.redis.zrevrange(key, start, stop);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.redis.publish(channel, message);
  }

  async subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void> {
    await this.redis.subscribe(channel);
    this.redis.on('message', callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.redis.unsubscribe(channel);
  }

  async incr(key: string): Promise<number> {
    return this.redis.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.redis.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async multi(): Promise<RedisClient> {
    return this.redis.multi();
  }

  async exec(): Promise<any[]> {
    return this.redis.exec();
  }
}
