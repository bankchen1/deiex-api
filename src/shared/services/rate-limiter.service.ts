import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../modules/redis/redis.service';

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  async checkLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const redis = this.redisService.getClient();
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / windowMs)}`;

    try {
      const multi = redis.multi();
      multi.incr(windowKey);
      multi.pexpire(windowKey, windowMs);
      
      const results = await multi.exec();
      if (!results) {
        return false;
      }

      const [incrErr, incrResult] = results[0];
      if (incrErr) {
        throw incrErr;
      }

      const count = incrResult as number;
      return count <= maxRequests;
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error.message}`);
      return false;
    }
  }

  async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    return this.checkLimit(key, windowSeconds * 1000, maxRequests);
  }
}
