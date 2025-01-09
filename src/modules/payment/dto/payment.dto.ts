import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class CreatePaymentOrderDto {
  @ApiProperty({ description: '用户ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: '支付金额' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: '支付货币类型' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: '支付方式' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ description: '支付描述' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePaymentOrderDto {
  @ApiProperty({ description: '支付状态', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiProperty({ description: '交易ID' })
  @IsString()
  @IsOptional()
  transactionId?: string;
}

export class CreateTransactionDto {
  @ApiProperty({ description: '用户ID' })
  @IsNumber()
  userId: number;

  @ApiProperty({ description: '支付订单ID' })
  @IsNumber()
  @IsNotEmpty()
  paymentOrderId: number;

  @ApiProperty({ description: '交易金额' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: '交易货币类型' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: '交易状态', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;
} 