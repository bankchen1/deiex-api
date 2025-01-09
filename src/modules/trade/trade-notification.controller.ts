import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TradeNotificationService } from './trade-notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  NotificationPreferencesDto,
  TradeNotification,
} from './dto/trade-notification.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Trade Notifications')
@Controller('trade-notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TradeNotificationController {
  constructor(
    private readonly tradeNotificationService: TradeNotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications' })
  async getNotifications(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<{ notifications: TradeNotification[]; total: number }> {
    return this.tradeNotificationService.getNotifications(
      req.user.id,
      page,
      limit,
    );
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @Request() req,
    @Param('id') notificationId: string,
  ): Promise<void> {
    return this.tradeNotificationService.markAsRead(
      req.user.id,
      notificationId,
    );
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req): Promise<void> {
    return this.tradeNotificationService.markAllAsRead(req.user.id);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @Request() req,
    @Body() preferences: NotificationPreferencesDto,
  ): Promise<void> {
    return this.tradeNotificationService.updateNotificationPreferences(
      req.user.id,
      preferences,
    );
  }
}
