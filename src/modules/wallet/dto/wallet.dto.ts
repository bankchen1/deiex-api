import { IsString, IsNumber, IsEnum, IsOptional, IsDate, Min, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  TRANSFER = 'transfer',
  TRADE = 'trade',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export class GetTransactionsDto {
  @ApiProperty({ description: '页码', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ description: '开始日期', required: false })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ description: '结束日期', required: false })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ description: '交易类型', enum: TransactionType, required: false })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiProperty({ description: '交易状态', enum: TransactionStatus, required: false })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;
}

export class CreateTransactionDto {
  @ApiProperty({ description: '交易类型', enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ description: '金额' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: '货币类型' })
  @IsString()
  currency: string;

  @ApiProperty({ description: '2FA验证码', required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: '附加数据', required: false })
  @IsObject()
  @IsOptional()
  additionalData?: Record<string, any>;
}

export class ExportTransactionsDto extends GetTransactionsDto {
  @ApiProperty({ description: '导出格式', enum: ['csv', 'excel'] })
  @IsEnum(['csv', 'excel'])
  format: 'csv' | 'excel';
} 