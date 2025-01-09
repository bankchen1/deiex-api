import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { MarketService } from '../market.service';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DepthService } from '../services/depth.service';
import { PrometheusService } from '../../monitoring/services/prometheus.service';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';

interface SubscriptionMessage {
  symbol: string;
  channel: string;
}

@WebSocketGateway({
  namespace: 'market',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
@Injectable()
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketGateway.name);
  private readonly clientSubscriptions = new Map<string, Set<string>>();
  private readonly channelBuffers = new Map<string, any[]>();
  private readonly BUFFER_SIZE = 1000;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1分钟
  private readonly MAX_SUBSCRIPTIONS = 50; // 每个客户端最大订阅数

  constructor(
    private readonly marketService: MarketService,
    private readonly depthService: DepthService,
    @InjectRedis() private readonly redis: Redis,
    private readonly eventEmitter: EventEmitter2,
    private readonly prometheusService: PrometheusService,
    private readonly rateLimiter: RateLimiterService,
  ) {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    // 监听深度更新事件
    this.eventEmitter.on('depth.updated', (data) => {
      this.broadcastToChannel(`${data.symbol}:depth`, {
        type: 'depth',
        data: data.depth,
        timestamp: Date.now(),
      });
    });

    // 监听K线更新事件
    this.eventEmitter.on('kline.updated', (data) => {
      this.broadcastToChannel(`${data.symbol}:kline`, {
        type: 'kline',
        data: data,
        timestamp: Date.now(),
      });
    });

    // 监听Ticker更新事件
    this.eventEmitter.on('ticker.updated', (data) => {
      this.broadcastToChannel(`${data.symbol}:ticker`, {
        type: 'ticker',
        data: data,
        timestamp: Date.now(),
      });
    });
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);
      this.clientSubscriptions.set(client.id, new Set());
      
      // 记录连接指标
      this.prometheusService.incrementConnections();
      
      // 发送当前市场状态
      const marketStatus = await this.marketService.getMarketStatus();
      client.emit('market_status', marketStatus);
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      this.logger.log(`Client disconnected: ${client.id}`);
      await this.marketService.unsubscribeFromMarketData(client.id);
      this.clientSubscriptions.delete(client.id);
      
      // 记录断开连接指标
      this.prometheusService.decrementConnections();
    } catch (error) {
      this.logger.error(`Disconnection error: ${error.message}`);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: SubscriptionMessage,
  ) {
    const startTime = Date.now();
    try {
      // 检查速率限制
      const canSubscribe = await this.rateLimiter.checkLimit(
        `ws:${client.id}`,
        this.RATE_LIMIT_WINDOW,
        this.MAX_SUBSCRIPTIONS
      );
      
      if (!canSubscribe) {
        throw new WsException('Rate limit exceeded');
      }

      const { symbol, channel } = message;
      if (!symbol || !channel) {
        throw new WsException('Invalid subscription message');
      }

      const subscriptions = this.clientSubscriptions.get(client.id);
      const subKey = `${symbol}:${channel}`;
      
      if (subscriptions?.has(subKey)) {
        return { event: 'error', data: 'Already subscribed to this channel' };
      }

      if (subscriptions?.size >= this.MAX_SUBSCRIPTIONS) {
        throw new WsException('Maximum subscription limit reached');
      }

      await this.marketService.subscribeToMarketData(client.id, symbol, channel);
      subscriptions?.add(subKey);

      // 发送初始数据
      const initialData = await this.getInitialData(symbol, channel);
      client.emit('data', {
        symbol,
        channel,
        data: initialData,
      });

      // 记录订阅指标
      this.prometheusService.recordSubscription(symbol, channel);

      return { event: 'subscribed', data: { symbol, channel } };
    } catch (error) {
      this.logger.error(`Subscription error: ${error.message}`);
      // 记录错误指标
      this.prometheusService.incrementErrors('subscription_error');
      throw new WsException(error.message);
    } finally {
      // 记录处理时间
      this.prometheusService.recordLatency('subscription_latency', Date.now() - startTime);
    }
  }

  private async getInitialData(symbol: string, channel: string): Promise<any> {
    switch (channel) {
      case 'depth':
        return await this.depthService.getDepth(symbol);
      case 'kline':
        return await this.marketService.getKlineData(symbol);
      case 'ticker':
        return await this.marketService.getTickerData(symbol);
      default:
        throw new WsException('Invalid channel');
    }
  }

  private broadcastToChannel(channel: string, data: any) {
    // 更新channel buffer
    const buffer = this.channelBuffers.get(channel) || [];
    buffer.push(data);
    if (buffer.length > this.BUFFER_SIZE) {
      buffer.shift();
    }
    this.channelBuffers.set(channel, buffer);

    // 广播数据
    this.server.to(channel).emit('data', data);
    
    // 记录广播指标
    this.prometheusService.incrementBroadcasts(channel);
  }

  // 获取channel的历史数据
  @SubscribeMessage('history')
  async getChannelHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: { symbol: string; channel: string; limit?: number },
  ) {
    try {
      const { symbol, channel, limit = 100 } = message;
      const buffer = this.channelBuffers.get(`${symbol}:${channel}`) || [];
      return buffer.slice(-Math.min(limit, this.BUFFER_SIZE));
    } catch (error) {
      this.logger.error(`History error: ${error.message}`);
      throw new WsException(error.message);
    }
  }

  // 获取服务器状态
  @SubscribeMessage('server_status')
  async getServerStatus() {
    try {
      const status = await this.marketService.getServerStatus();
      return {
        event: 'server_status',
        data: {
          ...status,
          connections: this.server.engine.clientsCount,
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      this.logger.error(`Server status error: ${error.message}`);
      throw new WsException(error.message);
    }
  }
}
