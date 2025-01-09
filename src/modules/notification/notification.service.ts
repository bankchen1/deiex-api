import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetNotificationsDto, CreatePriceAlertDto, CreateSystemNotificationDto } from './dto/notification.dto';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationService {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: number, query: GetNotificationsDto) {
    const { offset = 0, limit = 50 } = query;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: userId.toString() },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId: userId.toString() },
      }),
    ]);

    return { notifications, total };
  }

  async markAsRead(userId: number, notificationIds: number[]) {
    await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds.map(id => id.toString()) },
        userId: userId.toString(),
      },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId: userId.toString() },
      data: { isRead: true },
    });
  }

  async deleteNotification(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId.toString(),
        userId: userId.toString(),
      },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId.toString() },
    });
  }

  async createPriceAlert(userId: number, dto: CreatePriceAlertDto) {
    const existingAlert = await this.prisma.priceAlert.findFirst({
      where: {
        userId: userId.toString(),
        symbol: dto.symbol,
        price: dto.price,
        condition: dto.condition,
      },
    });

    if (existingAlert) {
      throw new BadRequestException('该价格提醒已存在');
    }

    return await this.prisma.priceAlert.create({
      data: {
        userId: userId.toString(),
        symbol: dto.symbol,
        price: dto.price,
        condition: dto.condition,
      },
    });
  }

  async getPriceAlerts(userId: number) {
    return await this.prisma.priceAlert.findMany({
      where: { userId: userId.toString() },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletePriceAlert(userId: number, alertId: number) {
    const alert = await this.prisma.priceAlert.findFirst({
      where: {
        id: alertId.toString(),
        userId: userId.toString(),
      },
    });

    if (!alert) {
      throw new NotFoundException('价格提醒不存在');
    }

    await this.prisma.priceAlert.delete({
      where: { id: alertId.toString() },
    });
  }

  async createSystemNotification(dto: CreateSystemNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        title: dto.title,
        message: dto.message,
        level: dto.level,
        type: 'SYSTEM',
      },
    });

    // 通过 WebSocket 广播系统通知
    this.server.emit('notification', notification);

    return notification;
  }

  // 用于其他服务调用的方法
  async createNotification(userId: number, title: string, message: string, type = 'SYSTEM') {
    const notification = await this.prisma.notification.create({
      data: {
        userId: userId.toString(),
        title,
        message,
        type,
      },
    });

    // 通过 WebSocket 发送通知给特定用户
    this.server.to(`user_${userId}`).emit('notification', notification);

    return notification;
  }
} 