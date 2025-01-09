import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { CopyTradingService } from '../copy-trading.service';

@WebSocketGateway({
  namespace: 'copy-trading',
  cors: {
    origin: '*',
  },
})
export class CopyTradingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly copyTradingService: CopyTradingService) {}

  @UseGuards(WsJwtGuard)
  async handleConnection(client: Socket) {
    const user = client.handshake.auth.user;
    if (user) {
      await client.join(`user_${user.id}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.handshake.auth.user;
    if (user) {
      await client.leave(`user_${user.id}`);
    }
  }

  @SubscribeMessage('subscribeToCopyTrading')
  @UseGuards(WsJwtGuard)
  async handleSubscribe(client: Socket, traderId: string) {
    await client.join(`copyTrading_${traderId}`);
  }

  @SubscribeMessage('unsubscribeFromCopyTrading')
  @UseGuards(WsJwtGuard)
  async handleUnsubscribe(client: Socket, traderId: string) {
    await client.leave(`copyTrading_${traderId}`);
  }

  // 发送复制交易更新
  sendCopyTradeUpdate(traderId: string, data: any) {
    this.server.to(`copyTrading_${traderId}`).emit('copyTradeUpdate', data);
  }

  // 发送交易者统计更新
  sendTraderStatsUpdate(traderId: string, stats: any) {
    this.server.to(`copyTrading_${traderId}`).emit('traderStatsUpdate', stats);
  }

  // 发送个人复制交易通知
  sendPersonalCopyTradeNotification(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('copyTradeNotification', notification);
  }
} 