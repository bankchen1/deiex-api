import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  Min, 
  IsEnum,
  Matches,
} from 'class-validator';
import { TransactionType, TransactionStatus } from '../types/wallet.types';

export class CreateWithdrawalDto {
  @ApiProperty({
    description: '提现币种',
    example: 'BTC',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: '提现链',
    example: 'BTC',
  })
  @IsString()
  chain: string;

  @ApiProperty({
    description: '提现金额',
    example: 1.5,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: '提现地址',
    example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: '无效的提现地址',
  })
  toAddress: string;

  @ApiProperty({
    description: '备注',
    required: false,
    example: '提现到Binance',
  })
  @IsOptional()
  @IsString()
  memo?: string;
}

export class WithdrawalHistoryQueryDto {
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
  startTime?: Date;

  @ApiProperty({
    description: '结束时间',
    required: false,
    example: '2025-01-08T00:00:00Z',
  })
  @IsOptional()
  endTime?: Date;

  @ApiProperty({
    description: '页码',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
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
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class WithdrawalFeeDto {
  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: '金额',
    example: 1.5,
  })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class AddressWhitelistDto {
  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: '链',
    example: 'BTC',
  })
  @IsString()
  chain: string;

  @ApiProperty({
    description: '地址',
    example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: '无效的地址格式',
  })
  address: string;

  @ApiProperty({
    description: '地址标签',
    example: 'Binance充值地址',
  })
  @IsString()
  label: string;
}
