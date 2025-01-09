import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../auth/decorators/user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  GetNotificationsDto,
  MarkAsReadDto,
  CreatePriceAlertDto,
  CreateSystemNotificationDto,
} from './dto/notification.dto';

@ApiTags('通知')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '获取用户通知列表' })
  @ApiResponse({ status: 200, description: '获取通知列表成功' })
  async getNotifications(
    @User('id') userId: number,
    @Query() query: GetNotificationsDto,
  ) {
    const { notifications, total } = await this.notificationService.getNotifications(userId, query);
    return {
      data: notifications,
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  @Put('read')
  @ApiOperation({ summary: '标记通知为已读' })
  @ApiResponse({ status: 200, description: '标记成功' })
  async markAsRead(
    @User('id') userId: number,
    @Body() dto: MarkAsReadDto,
  ) {
    await this.notificationService.markAsRead(userId, dto.notificationIds);
    return { success: true };
  }

  @Put('read/all')
  @ApiOperation({ summary: '标记所有通知为已读' })
  @ApiResponse({ status: 200, description: '标记成功' })
  async markAllAsRead(@User('id') userId: number) {
    await this.notificationService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除通知' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteNotification(
    @User('id') userId: number,
    @Param('id') id: string,
  ) {
    await this.notificationService.deleteNotification(userId, parseInt(id));
    return { success: true };
  }

  @Post('price-alerts')
  @ApiOperation({ summary: '创建价格提醒' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createPriceAlert(
    @User('id') userId: number,
    @Body() dto: CreatePriceAlertDto,
  ) {
    return await this.notificationService.createPriceAlert(userId, dto);
  }

  @Get('price-alerts')
  @ApiOperation({ summary: '获取价格提醒列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPriceAlerts(@User('id') userId: number) {
    return await this.notificationService.getPriceAlerts(userId);
  }

  @Delete('price-alerts/:id')
  @ApiOperation({ summary: '删除价格提醒' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deletePriceAlert(
    @User('id') userId: number,
    @Param('id') id: string,
  ) {
    await this.notificationService.deletePriceAlert(userId, parseInt(id));
    return { success: true };
  }

  @Post('system')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '创建系统通知（仅管理员）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createSystemNotification(@Body() dto: CreateSystemNotificationDto) {
    await this.notificationService.createSystemNotification(dto);
    return { success: true };
  }
} 