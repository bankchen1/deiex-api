import { registerAs } from '@nestjs/config';

export default registerAs('market', () => ({
  binance: {
    wsEndpoint: process.env.BINANCE_WS_ENDPOINT || 'wss://stream.binance.com:9443/ws',
    apiEndpoint: process.env.BINANCE_API_ENDPOINT || 'https://api.binance.com/api/v3',
  },
  coingecko: {
    apiEndpoint: process.env.COINGECKO_API_ENDPOINT || 'https://api.coingecko.com/api/v3',
    apiKey: process.env.COINGECKO_API_KEY,
  },
  cache: {
    ttl: parseInt(process.env.MARKET_CACHE_TTL, 10) || 60, // 缓存时间，单位：秒
  },
  update: {
    interval: parseInt(process.env.MARKET_UPDATE_INTERVAL, 10) || 60000, // 更新间隔，单位：毫秒
  },
  websocket: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL, 10) || 30000, // ping间隔，单位：毫秒
    pongTimeout: parseInt(process.env.WS_PONG_TIMEOUT, 10) || 5000, // pong超时，单位：毫秒
    reconnectInterval: parseInt(process.env.WS_RECONNECT_INTERVAL, 10) || 5000, // 重连间隔，单位：毫秒
    maxReconnectAttempts: parseInt(process.env.WS_MAX_RECONNECT_ATTEMPTS, 10) || 5, // 最大重连次数
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },
}));
