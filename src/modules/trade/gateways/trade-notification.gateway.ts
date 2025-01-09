import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@WebSocketGateway({
  namespace: 'notifications',
  cors: true,
})
@UseGuards(WsJwtGuard)
export class TradeNotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private subscriberClient: Redis;

  constructor(@InjectRedis() private readonly redis: Redis) {
    // 创建单独的 Redis 客户端用于订阅
    this.subscriberClient = redis.duplicate();
    this.setupRedisSubscription();
  }

  private async setupRedisSubscription() {
    // 订阅所有通知频道
    await this.subscriberClient.psubscribe('notifications:*');

    this.subscriberClient.on('pmessage', (pattern, channel, message) => {
      const userId = channel.split(':')[1];
      const notification = JSON.parse(message);

      // 向特定用户的房间广播通知
      this.server.to(`user:${userId}`).emit('notification', notification);
    });
  }

  async handleConnection(client: Socket) {
    const userId = client.user?.id;
    if (userId) {
      // 将客户端加入到用户特定的房间
      await client.join(`user:${userId}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.user?.id;
    if (userId) {
      // 将客户端从用户特定的房间中移除
      await client.leave(`user:${userId}`);
    }
  }

  @SubscribeMessage('readNotification')
  async handleReadNotification(client: Socket, notificationId: string) {
    // 可以在这里处理标记通知为已读的逻辑
    this.server
      .to(`user:${client.user.id}`)
      .emit('notificationRead', notificationId);
  }
}
