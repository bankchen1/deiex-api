import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { RedisModuleOptions } from '@nestjs-modules/ioredis';

export const postgresConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: '128.199.180.226',
  port: 5433,
  username: 'deiex',
  password: 'youhuo123-',
  database: 'deiex_db',
  entities: ['dist/**/*.entity{.ts,.js}'],
  synchronize: false, // 生产环境应该设置为 false
  logging: true,
  logger: 'advanced-console',
  maxQueryExecutionTime: 1000,
  ssl: false,
  cache: {
    type: 'ioredis',
    options: {
      host: 'localhost',
      port: 6379,
      password: 'hackyh123-',
      db: 0,
    },
    duration: 60000, // 1分钟缓存
  },
  extra: {
    max: 100, // 连接池最大连接数
    connectionTimeoutMillis: 10000, // 连接超时时间
    idleTimeoutMillis: 30000, // 空闲连接超时时间
  },
};

export const redisConfig: RedisModuleOptions = {
  config: {
    host: 'localhost',
    port: 6379,
    password: 'hackyh123-',
    db: 0,
    keyPrefix: 'deiex:',
    retryStrategy: (times: number) => {
      return Math.min(times * 50, 2000);
    },
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  },
};
