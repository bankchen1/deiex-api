import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsResponse,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { TradeService } from '../trade.service';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderResponseDto, TradeResponseDto } from '../dto/trade.dto';

interface SubscriptionMessage {
  symbol: string;
  channel: 'orderbook' | 'trades' | 'ticker';
}

@WebSocketGateway({
  namespace: 'trades',
  cors: {
    origin: '*',
  },
})
@UseGuards(WsJwtGuard)
export class TradeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly tradeService: TradeService) {}

  async handleConnection(client: Socket) {
    try {
      // 验证连接
      if (!client.handshake.auth.token) {
        client.disconnect();
        return;
      }

      // 初始化用户订阅集合
      this.subscriptions.set(client.id, new Set());
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // 清理用户订阅
    this.subscriptions.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: SubscriptionMessage,
  ): Promise<WsResponse<any>> {
    const userSubscriptions = this.subscriptions.get(client.id);
    if (!userSubscriptions) {
      throw new Error('Client not initialized');
    }

    const subscriptionKey = `${message.symbol}:${message.channel}`;
    userSubscriptions.add(subscriptionKey);

    // 发送初始数据
    switch (message.channel) {
      case 'orderbook':
        const orderBook = await this.tradeService.getOrderBook(message.symbol);
        client.emit('orderbook', {
          symbol: message.symbol,
          data: orderBook,
        });
        break;
      case 'trades':
        // 获取最近的交易
        const trades = await this.tradeService.getUserTrades(client['user'].id, {
          symbol: message.symbol,
          limit: 50,
        });
        client.emit('trades', {
          symbol: message.symbol,
          data: trades,
        });
        break;
      case 'ticker':
        const statistics = await this.tradeService.getTradeStatistics(message.symbol);
        client.emit('ticker', {
          symbol: message.symbol,
          data: statistics,
        });
        break;
    }

    return {
      event: 'subscribed',
      data: { symbol: message.symbol, channel: message.channel },
    };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: SubscriptionMessage,
  ): Promise<WsResponse<any>> {
    const userSubscriptions = this.subscriptions.get(client.id);
    if (!userSubscriptions) {
      throw new Error('Client not initialized');
    }

    const subscriptionKey = `${message.symbol}:${message.channel}`;
    userSubscriptions.delete(subscriptionKey);

    return {
      event: 'unsubscribed',
      data: { symbol: message.symbol, channel: message.channel },
    };
  }

  @OnEvent('order.created')
  handleOrderCreated(order: OrderResponseDto) {
    this.broadcastToSymbol(order.symbol, 'order', {
      event: 'ORDER_CREATED',
      data: order,
    });
  }

  @OnEvent('order.updated')
  handleOrderUpdated(order: OrderResponseDto) {
    this.broadcastToSymbol(order.symbol, 'order', {
      event: 'ORDER_UPDATED',
      data: order,
    });
  }

  @OnEvent('order.canceled')
  handleOrderCanceled(order: OrderResponseDto) {
    this.broadcastToSymbol(order.symbol, 'order', {
      event: 'ORDER_CANCELED',
      data: order,
    });
  }

  @OnEvent('trade.created')
  handleTradeCreated(trade: TradeResponseDto) {
    this.broadcastToSymbol(trade.symbol, 'trades', {
      event: 'TRADE_CREATED',
      data: trade,
    });
  }

  @OnEvent('orderbook.updated')
  handleOrderBookUpdated(update: { symbol: string; data: any }) {
    this.broadcastToSymbol(update.symbol, 'orderbook', {
      event: 'ORDERBOOK_UPDATED',
      data: update.data,
    });
  }

  private broadcastToSymbol(symbol: string, channel: string, message: any) {
    // 向所有订阅了该交易对和通道的客户端广播更新
    for (const [clientId, subscriptions] of this.subscriptions.entries()) {
      if (subscriptions.has(`${symbol}:${channel}`)) {
        this.server.to(clientId).emit(channel, message);
      }
    }
  }
}
