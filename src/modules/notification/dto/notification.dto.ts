import { IsString, IsNumber, IsArray, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export class GetNotificationsDto {
  @ApiProperty({ description: '分页偏移量', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  offset?: number = 0;

  @ApiProperty({ description: '每页数量', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class MarkAsReadDto {
  @ApiProperty({ description: '通知ID列表' })
  @IsArray()
  @IsNumber({}, { each: true })
  notificationIds: number[];
}

export class CreatePriceAlertDto {
  @ApiProperty({ description: '交易对符号' })
  @IsString()
  symbol: string;

  @ApiProperty({ description: '价格条件', enum: ['above', 'below'] })
  @IsEnum(['above', 'below'])
  condition: 'above' | 'below';

  @ApiProperty({ description: '目标价格' })
  @IsNumber()
  price: number;
}

export class CreateSystemNotificationDto {
  @ApiProperty({ description: '通知标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '通知内容' })
  @IsString()
  message: string;

  @ApiProperty({ description: '通知级别', enum: NotificationLevel })
  @IsEnum(NotificationLevel)
  level: NotificationLevel;
} 