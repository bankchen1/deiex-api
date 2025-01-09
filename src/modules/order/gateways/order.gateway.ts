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
import { OrderService } from '../order.service';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderResponseDto, OrderUpdateDto } from '../dto/order.dto';

interface SubscriptionMessage {
  symbol: string;
}

@WebSocketGateway({
  namespace: 'orders',
  cors: {
    origin: '*',
  },
})
@UseGuards(WsJwtGuard)
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly orderService: OrderService) {}

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

    const subscriptionKey = `${message.symbol}`;
    userSubscriptions.add(subscriptionKey);

    return {
      event: 'subscribed',
      data: { symbol: message.symbol },
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

    const subscriptionKey = `${message.symbol}`;
    userSubscriptions.delete(subscriptionKey);

    return {
      event: 'unsubscribed',
      data: { symbol: message.symbol },
    };
  }

  @OnEvent('order.created')
  handleOrderCreated(order: OrderResponseDto) {
    this.broadcastOrderUpdate(order.symbol, {
      event: 'ORDER_CREATED',
      data: order,
    });
  }

  @OnEvent('order.updated')
  handleOrderUpdated(order: OrderResponseDto) {
    this.broadcastOrderUpdate(order.symbol, {
      event: 'ORDER_UPDATED',
      data: order,
    });
  }

  @OnEvent('order.canceled')
  handleOrderCanceled(order: OrderResponseDto) {
    this.broadcastOrderUpdate(order.symbol, {
      event: 'ORDER_CANCELED',
      data: order,
    });
  }

  private broadcastOrderUpdate(symbol: string, update: any) {
    // 向所有订阅了该交易对的客户端广播更新
    for (const [clientId, subscriptions] of this.subscriptions.entries()) {
      if (subscriptions.has(symbol)) {
        this.server.to(clientId).emit('orderUpdate', update);
      }
    }
  }
}
