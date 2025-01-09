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
import { StrategyService } from '../strategy.service';

@WebSocketGateway({
  namespace: 'strategy',
  cors: {
    origin: '*',
  },
})
export class StrategyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly strategyService: StrategyService) {}

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

  @SubscribeMessage('subscribeToStrategy')
  @UseGuards(WsJwtGuard)
  async handleSubscribe(client: Socket, strategyId: string) {
    await client.join(`strategy_${strategyId}`);
  }

  @SubscribeMessage('unsubscribeFromStrategy')
  @UseGuards(WsJwtGuard)
  async handleUnsubscribe(client: Socket, strategyId: string) {
    await client.leave(`strategy_${strategyId}`);
  }

  // 发送策略更新
  sendStrategyUpdate(strategyId: string, data: any) {
    this.server.to(`strategy_${strategyId}`).emit('strategyUpdate', data);
  }

  // 发送策略绩效更新
  sendPerformanceUpdate(strategyId: string, performance: any) {
    this.server.to(`strategy_${strategyId}`).emit('performanceUpdate', performance);
  }

  // 发送回测结果
  sendBacktestResult(strategyId: string, result: any) {
    this.server.to(`strategy_${strategyId}`).emit('backtestResult', result);
  }

  // 发送订阅状态更新
  sendSubscriptionUpdate(userId: string, update: any) {
    this.server.to(`user_${userId}`).emit('subscriptionUpdate', update);
  }
} 