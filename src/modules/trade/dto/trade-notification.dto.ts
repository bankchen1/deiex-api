import { IsString, IsEnum, IsObject, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  TRADE_EXECUTED = 'TRADE_EXECUTED',
  TRADE_CLOSED = 'TRADE_CLOSED',
  POSITION_LIQUIDATED = 'POSITION_LIQUIDATED',
  MARGIN_CALL = 'MARGIN_CALL',
  STOP_LOSS_TRIGGERED = 'STOP_LOSS_TRIGGERED',
  TAKE_PROFIT_TRIGGERED = 'TAKE_PROFIT_TRIGGERED',
  ORDER_FILLED = 'ORDER_FILLED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class NotificationPreferencesDto {
  @ApiProperty()
  @IsBoolean()
  emailEnabled: boolean;

  @ApiProperty()
  @IsBoolean()
  pushEnabled: boolean;

  @ApiProperty()
  @IsBoolean()
  webSocketEnabled: boolean;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  typePreferences?: {
    [key in NotificationType]?: {
      email: boolean;
      push: boolean;
      webSocket: boolean;
    };
  };
}

export interface TradeNotification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: Date;
}
