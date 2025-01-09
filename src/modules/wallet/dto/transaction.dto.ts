import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  Min, 
  IsEnum,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType, TransactionStatus } from '../types/wallet.types';

export class TransactionHistoryQueryDto {
  @ApiProperty({
    description: '币种',
    required: false,
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: '交易类型',
    required: false,
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: '交易状态',
    required: false,
    enum: TransactionStatus,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: '开始时间',
    required: false,
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startTime?: Date;

  @ApiProperty({
    description: '结束时间',
    required: false,
    example: '2025-01-08T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;

  @ApiProperty({
    description: '页码',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: '排序字段',
    required: false,
    default: 'createdAt',
    enum: ['createdAt', 'amount', 'status'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: '排序方向',
    required: false,
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class TransactionStatsQueryDto {
  @ApiProperty({
    description: '币种',
    required: false,
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: '交易类型',
    required: false,
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: '开始时间',
    required: false,
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startTime?: Date;

  @ApiProperty({
    description: '结束时间',
    required: false,
    example: '2025-01-08T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;
}

export class TransactionSearchQueryDto {
  @ApiProperty({
    description: '搜索关键词',
    example: '0x123...',
  })
  @IsString()
  q: string;

  @ApiProperty({
    description: '币种',
    required: false,
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: '交易类型',
    required: false,
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: '交易状态',
    required: false,
    enum: TransactionStatus,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: '页码',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class TransactionExportQueryDto {
  @ApiProperty({
    description: '币种',
    required: false,
    example: 'BTC',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: '交易类型',
    required: false,
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({
    description: '交易状态',
    required: false,
    enum: TransactionStatus,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiProperty({
    description: '开始时间',
    required: false,
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startTime?: Date;

  @ApiProperty({
    description: '结束时间',
    required: false,
    example: '2025-01-08T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endTime?: Date;

  @ApiProperty({
    description: '导出格式',
    required: false,
    default: 'csv',
    enum: ['csv', 'excel'],
  })
  @IsOptional()
  @IsString()
  format?: 'csv' | 'excel' = 'csv';
}
