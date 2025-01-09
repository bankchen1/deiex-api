import { IsString, IsNumber, IsEnum, Min, IsOptional, IsUUID, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '../types/asset.types';
import { Type } from 'class-transformer';

export class AssetDto {
  @ApiProperty({ description: 'Asset ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Currency code (e.g., BTC, ETH, USDT)' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Available balance' })
  @IsNumber()
  @Min(0)
  balance: number;

  @ApiProperty({ description: 'Locked balance (in orders or pending withdrawals)' })
  @IsNumber()
  @Min(0)
  locked: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;
}

export class TransactionDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Currency code' })
  @IsString()
  currency: string;

  @ApiProperty({ enum: TransactionType, description: 'Transaction type' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: TransactionStatus, description: 'Transaction status' })
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @ApiProperty({ description: 'Blockchain transaction hash', required: false })
  @IsString()
  @IsOptional()
  txHash?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @IsDate()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @IsDate()
  @Type(() => Date)
  updatedAt: Date;
}

export class CreateTransactionDto {
  @ApiProperty({ description: 'Currency code (e.g., BTC, ETH, USDT)' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Transaction amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: TransactionType, description: 'Transaction type' })
  @IsEnum(TransactionType)
  type: TransactionType;
}

export class WithdrawDto {
  @ApiProperty({ description: 'Currency code (e.g., BTC, ETH, USDT)' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Withdrawal amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Withdrawal address' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Optional memo or tag for some currencies', required: false })
  @IsString()
  @IsOptional()
  memo?: string;
}

export class DepositDto {
  @ApiProperty({ description: 'Currency code (e.g., BTC, ETH, USDT)' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Deposit amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Blockchain transaction hash' })
  @IsString()
  txHash: string;
}

export class TransactionQueryDto {
  @ApiProperty({ description: 'Start time in milliseconds', required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  startTime?: number;

  @ApiProperty({ description: 'End time in milliseconds', required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  endTime?: number;

  @ApiProperty({ description: 'Transaction type', required: false, enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiProperty({ description: 'Transaction status', required: false, enum: TransactionStatus })
  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @ApiProperty({ description: 'Currency code', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'Number of records to return', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 100;

  @ApiProperty({ description: 'Number of records to skip', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

export class BalanceQueryDto {
  @ApiProperty({ description: 'Currency code', required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'Show zero balances', required: false })
  @IsOptional()
  @Type(() => Boolean)
  showZero?: boolean = false;
}
