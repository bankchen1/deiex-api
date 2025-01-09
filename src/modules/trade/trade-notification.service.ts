import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import {
  NotificationType,
  NotificationPriority,
  NotificationPreferencesDto,
  TradeNotification,
} from './dto/trade-notification.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TradeNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {
    // 订阅交易相关事件
    this.subscribeToTradeEvents();
  }

  private subscribeToTradeEvents() {
    this.eventEmitter.on('trade.executed', (trade) => {
      this.notifyTradeExecution(trade);
    });

    this.eventEmitter.on('trade.closed', (trade) => {
      this.notifyTradeClosed(trade);
    });

    this.eventEmitter.on('position.liquidated', (position) => {
      this.notifyPositionLiquidated(position);
    });

    this.eventEmitter.on('margin.call', (position) => {
      this.notifyMarginCall(position);
    });
  }

  async notifyTradeExecution(trade: any): Promise<void> {
    const notification = await this.createNotification({
      userId: trade.userId,
      type: NotificationType.TRADE_EXECUTED,
      priority: NotificationPriority.HIGH,
      title: 'Trade Executed',
      message: `Your ${trade.side} order for ${trade.amount} ${trade.symbol} has been executed at ${trade.price}`,
      data: trade,
    });

    await this.sendNotification(notification);
  }

  async notifyTradeClosed(trade: any): Promise<void> {
    const pnl = trade.profit;
    const pnlText = pnl >= 0 ? `profit of ${pnl}` : `loss of ${Math.abs(pnl)}`;

    const notification = await this.createNotification({
      userId: trade.userId,
      type: NotificationType.TRADE_CLOSED,
      priority: NotificationPriority.HIGH,
      title: 'Trade Closed',
      message: `Your trade on ${trade.symbol} has been closed with a ${pnlText}`,
      data: trade,
    });

    await this.sendNotification(notification);
  }

  async notifyPositionLiquidated(position: any): Promise<void> {
    const notification = await this.createNotification({
      userId: position.userId,
      type: NotificationType.POSITION_LIQUIDATED,
      priority: NotificationPriority.URGENT,
      title: 'Position Liquidated',
      message: `Your position on ${position.symbol} has been liquidated`,
      data: position,
    });

    await this.sendNotification(notification);
  }

  async notifyMarginCall(position: any): Promise<void> {
    const notification = await this.createNotification({
      userId: position.userId,
      type: NotificationType.MARGIN_CALL,
      priority: NotificationPriority.URGENT,
      title: 'Margin Call Warning',
      message: `Your position on ${position.symbol} is close to liquidation price. Please add margin or reduce position.`,
      data: position,
    });

    await this.sendNotification(notification);
  }

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ notifications: TradeNotification[]; total: number }> {
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId },
      }),
    ]);

    return { notifications, total };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
      },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreferencesDto,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreferences: preferences,
      },
    });
  }

  private async createNotification(params: {
    userId: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    data: any;
  }): Promise<TradeNotification> {
    return this.prisma.notification.create({
      data: {
        id: uuidv4(),
        ...params,
        read: false,
      },
    });
  }

  private async sendNotification(
    notification: TradeNotification,
  ): Promise<void> {
    // 获取用户的通知偏好设置
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      select: { notificationPreferences: true },
    });

    const preferences = user?.notificationPreferences;

    // 发送 WebSocket 通知
    if (preferences?.webSocketEnabled) {
      await this.redis.publish(
        `notifications:${notification.userId}`,
        JSON.stringify(notification),
      );
    }

    // 发送邮件通知
    if (preferences?.emailEnabled) {
      this.eventEmitter.emit('notification.email', {
        to: user.email,
        subject: notification.title,
        content: notification.message,
      });
    }

    // 发送推送通知
    if (preferences?.pushEnabled) {
      this.eventEmitter.emit('notification.push', {
        userId: notification.userId,
        title: notification.title,
        body: notification.message,
        data: notification.data,
      });
    }
  }
}
