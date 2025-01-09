import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MarketService } from '../market.service';
import {
  MarketEventData,
  OrderBookDto,
  KlineDto,
  TickerDto,
  TradeDto,
} from '../dto/market.dto';
import { KlineInterval } from '../types/kline-interval.type';

@WebSocketGateway({
  namespace: 'market',
  cors: {
    origin: '*',
  },
})
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketGateway.name);
  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly marketService: MarketService) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.removeClientSubscriptions(client.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type: string; symbol: string }
  ): Promise<void> {
    try {
      const { type, symbol } = data;
      const room = `${type}:${symbol}`;

      await client.join(room);
      this.logger.log(`Client ${client.id} subscribed to ${room}`);
    } catch (error) {
      this.logger.error(`Failed to handle subscription: ${error.message}`);
      client.emit('error', { message: 'Failed to subscribe' });
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() channel: string,
  ) {
    try {
      this.removeSubscription(client.id, channel);
      this.logger.log(`Client ${client.id} unsubscribed from: ${channel}`);
    } catch (error) {
      this.logger.error(
        `Unsubscribe error: ${error.message}`,
        error.stack,
      );
      client.emit('error', { message: 'Failed to unsubscribe' });
    }
  }

  broadcastMarketEvent(event: MarketEventData) {
    const channel = `${event.type}:${event.symbol}`;
    const subscribers = this.getSubscribers(channel);
    
    if (subscribers.size > 0) {
      this.server.to(Array.from(subscribers)).emit(event.type, event);
    }
  }

  private addSubscription(clientId: string, channel: string) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);
  }

  private removeSubscription(clientId: string, channel: string) {
    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  private removeClientSubscriptions(clientId: string) {
    for (const [channel, subscribers] of this.subscriptions.entries()) {
      if (subscribers.has(clientId)) {
        this.removeSubscription(clientId, channel);
      }
    }
  }

  private getSubscribers(channel: string): Set<string> {
    return this.subscriptions.get(channel) || new Set();
  }
}
