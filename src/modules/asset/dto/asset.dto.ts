import { ApiProperty } from '@nestjs/swagger';

export class AssetDto {
  @ApiProperty({ description: '资产ID' })
  id: string;

  @ApiProperty({ description: '用户ID' })
  userId: string;

  @ApiProperty({ description: '货币代码' })
  currency: string;

  @ApiProperty({ description: '可用余额' })
  available: string;

  @ApiProperty({ description: '锁定余额' })
  locked: string;

  @ApiProperty({ description: '总余额' })
  total: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class CreateDepositDto {
  @ApiProperty({ description: '货币代码' })
  currency: string;

  @ApiProperty({ description: '存款金额' })
  amount: string;

  @ApiProperty({ description: '存款地址' })
  address: string;

  @ApiProperty({ description: '区块链网络' })
  chain: string;
}

export class CreateWithdrawDto {
  @ApiProperty({ description: '货币代码' })
  currency: string;

  @ApiProperty({ description: '提现金额' })
  amount: string;

  @ApiProperty({ description: '提现地址' })
  address: string;

  @ApiProperty({ description: '区块链网络' })
  chain: string;

  @ApiProperty({ description: '手续费' })
  fee: string;
}

export class TransactionQueryDto {
  @ApiProperty({ description: '货币代码', required: false })
  currency?: string;

  @ApiProperty({ description: '交易类型', required: false })
  type?: 'DEPOSIT' | 'WITHDRAW';

  @ApiProperty({ description: '交易状态', required: false })
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @ApiProperty({ description: '每页数量', required: false })
  limit?: number;

  @ApiProperty({ description: '偏移量', required: false })
  offset?: number;
}
