import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody, WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MarketService } from '../market.service';
import { RedisService } from '../../../modules/redis/redis.service';
import { RateLimiterService } from '../../../shared/services/rate-limiter.service';
import { Logger, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrometheusService } from '../../../shared/services/prometheus.service';

interface SubscriptionMessage {
  symbol: string;
  channel: string;
}

@Injectable()
@WebSocketGateway({
  namespace: 'market',
  cors: {
    origin: '*',
  },
})
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MarketGateway.name);
  @WebSocketServer() server: Server;

  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_SUBSCRIPTIONS = 50; // Max subscriptions per client
  private readonly BUFFER_SIZE = 1000; // Maximum number of messages to buffer
  private readonly clientSubscriptions = new Map<string, Set<string>>();
  private readonly channelBuffers = new Map<string, any[]>();
  private readonly eventEmitter: EventEmitter2;

  constructor(
    private readonly marketService: MarketService,
    private readonly redisService: RedisService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly prometheusService: PrometheusService,
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
      // 检查连接限制
      const canConnect = await this.rateLimiterService.checkRateLimit(
        `ws:connect:${client.handshake.address}`,
        1,
        60,
      );

      if (!canConnect) {
        throw new WsException('Too many connection attempts. Please try again later.');
      }

      // 初始化客户端订阅集合
      this.clientSubscriptions.set(client.id, new Set());

      // 更新连接指标
      this.prometheusService.incrementWebSocketConnections();

      // 发送市场状态
      const marketStatus = await this.marketService.getMarketStatus();
      client.emit('market_status', marketStatus);
    } catch (error) {
      client.disconnect();
      this.logger.error(`Connection error: ${error.message}`);
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      // 清理客户端订阅
      await this.marketService.unsubscribeFromMarketData(client.id);
      this.clientSubscriptions.delete(client.id);

      // 更新连接指标
      this.prometheusService.decrementWebSocketConnections();
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`);
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: SubscriptionMessage,
  ) {
    try {
      const { symbol, channel } = message;

      // 验证订阅参数
      if (!symbol || !channel) {
        throw new WsException('Invalid subscription parameters');
      }

      // 检查订阅数量限制
      const subscriptions = this.clientSubscriptions.get(client.id);
      if (subscriptions && subscriptions.size >= this.MAX_SUBSCRIPTIONS) {
        throw new WsException('Maximum subscription limit reached');
      }

      // 添加到订阅列表
      const channelKey = `${symbol}:${channel}`;
      subscriptions.add(channelKey);

      // 订阅市场数据
      await this.marketService.subscribeToMarketData(client.id, symbol, channel);

      // 发送确认消息
      client.emit('subscribed', { symbol, channel });

      // 更新订阅指标
      this.prometheusService.incrementSubscriptions(channel);

      // 发送缓存的数据
      await this.sendBufferedData(client, symbol, channel);

    } catch (error) {
      client.emit('error', { message: error.message });
      this.logger.error(`Subscription error: ${error.message}`);
    }
  }

  private async sendBufferedData(client: Socket, symbol: string, channel: string) {
    try {
      const channelKey = `${symbol}:${channel}`;
      const buffer = this.channelBuffers.get(channelKey) || [];

      if (buffer.length > this.BUFFER_SIZE) {
        buffer.splice(0, buffer.length - this.BUFFER_SIZE);
      }

      for (const data of buffer) {
        client.emit(channelKey, data);
      }

      // 更新指标
      this.prometheusService.observeMessageLatency(channel, Date.now() - buffer[buffer.length - 1]?.timestamp);

    } catch (error) {
      throw new WsException(`Failed to send buffered data: ${error.message}`);
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: { symbol: string; channel: string },
  ) {
    try {
      const { symbol, channel } = message;
      const channelKey = `${symbol}:${channel}`;

      // 从订阅列表中移除
      const subscriptions = this.clientSubscriptions.get(client.id);
      if (subscriptions) {
        subscriptions.delete(channelKey);
      }

      // 取消订阅市场数据
      await this.marketService.unsubscribeFromMarketData(client.id);

      // 发送确认消息
      client.emit('unsubscribed', { symbol, channel });

      // 更新指标
      this.prometheusService.decrementSubscriptions(channel);

    } catch (error) {
      client.emit('error', { message: error.message });
      this.logger.error(`Unsubscribe error: ${error.message}`);
    }
  }

  private broadcastToChannel(channel: string, data: any) {
    try {
      // 更新缓冲区
      let buffer = this.channelBuffers.get(channel) || [];
      buffer.push(data);

      if (buffer.length > this.BUFFER_SIZE) {
        buffer.splice(0, buffer.length - this.BUFFER_SIZE);
      }

      this.channelBuffers.set(channel, buffer);

      // 广播到所有订阅的客户端
      this.server.to(channel).emit(channel, data);

      // 更新指标
      this.prometheusService.incrementMessagesSent(channel);
    } catch (error) {
      this.logger.error(`Broadcast error: ${error.message}`);
    }
  }
}
