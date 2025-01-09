import { ApiProperty } from '@nestjs/swagger';
import { 
  TransactionType, 
  TransactionStatus,
  WalletStatus,
} from '../types/wallet.types';

export class WalletBalanceResponse {
  @ApiProperty({
    description: '钱包ID',
    example: 'wallet-123',
  })
  id: string;

  @ApiProperty({
    description: '用户ID',
    example: 'user-123',
  })
  userId: string;

  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  currency: string;

  @ApiProperty({
    description: '地址',
    example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  })
  address: string;

  @ApiProperty({
    description: '可用余额',
    example: 1.5,
  })
  balance: number;

  @ApiProperty({
    description: '冻结余额',
    example: 0.5,
  })
  frozenBalance: number;

  @ApiProperty({
    description: '总充值金额',
    example: 10,
  })
  totalDeposit: number;

  @ApiProperty({
    description: '总提现金额',
    example: 8,
  })
  totalWithdraw: number;

  @ApiProperty({
    description: '钱包状态',
    enum: WalletStatus,
  })
  status: WalletStatus;

  @ApiProperty({
    description: '创建时间',
  })
  createdAt: Date;

  @ApiProperty({
    description: '更新时间',
  })
  updatedAt: Date;
}

export class TransactionResponse {
  @ApiProperty({
    description: '交易ID',
    example: 'tx-123',
  })
  id: string;

  @ApiProperty({
    description: '用户ID',
    example: 'user-123',
  })
  userId: string;

  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  currency: string;

  @ApiProperty({
    description: '交易类型',
    enum: TransactionType,
  })
  type: TransactionType;

  @ApiProperty({
    description: '交易金额',
    example: 1.5,
  })
  amount: number;

  @ApiProperty({
    description: '手续费',
    example: 0.0001,
  })
  fee: number;

  @ApiProperty({
    description: '交易状态',
    enum: TransactionStatus,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: '交易哈希',
    example: '0x123...',
    required: false,
  })
  txHash?: string;

  @ApiProperty({
    description: '来源地址',
    example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    required: false,
  })
  fromAddress?: string;

  @ApiProperty({
    description: '目标地址',
    example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    required: false,
  })
  toAddress?: string;

  @ApiProperty({
    description: '确认数',
    example: 6,
    required: false,
  })
  confirmations?: number;

  @ApiProperty({
    description: '备注',
    example: '提现到Binance',
    required: false,
  })
  memo?: string;

  @ApiProperty({
    description: '创建时间',
  })
  createdAt: Date;

  @ApiProperty({
    description: '更新时间',
  })
  updatedAt: Date;
}

export class TransactionHistoryResponse {
  @ApiProperty({
    description: '交易列表',
    type: [TransactionResponse],
  })
  transactions: TransactionResponse[];

  @ApiProperty({
    description: '总数',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: '当前页码',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: '每页数量',
    example: 20,
  })
  limit: number;
}

export class TransactionStatsResponse {
  @ApiProperty({
    description: '交易总数',
    example: 100,
  })
  totalCount: number;

  @ApiProperty({
    description: '交易总额',
    example: 150.5,
  })
  totalAmount: number;

  @ApiProperty({
    description: '手续费总额',
    example: 0.15,
  })
  totalFee: number;
}

export class DailyTransactionStatsResponse {
  @ApiProperty({
    description: '日期',
    example: '2025-01-08',
  })
  date: string;

  @ApiProperty({
    description: '交易数量',
    example: 10,
  })
  count: number;

  @ApiProperty({
    description: '交易金额',
    example: 15.5,
  })
  amount: number;

  @ApiProperty({
    description: '手续费',
    example: 0.015,
  })
  fee: number;
}

export class WithdrawalLimitResponse {
  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  currency: string;

  @ApiProperty({
    description: '单笔最小金额',
    example: 0.001,
  })
  minAmount: number;

  @ApiProperty({
    description: '单笔最大金额',
    example: 10,
  })
  maxAmount: number;

  @ApiProperty({
    description: '每日限额',
    example: 50,
  })
  dailyLimit: number;

  @ApiProperty({
    description: '每月限额',
    example: 1000,
  })
  monthlyLimit: number;

  @ApiProperty({
    description: '今日已使用额度',
    example: 5,
  })
  dailyUsed: number;

  @ApiProperty({
    description: '本月已使用额度',
    example: 100,
  })
  monthlyUsed: number;
}

export class WithdrawalFeeResponse {
  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  currency: string;

  @ApiProperty({
    description: '提现金额',
    example: 1.5,
  })
  amount: number;

  @ApiProperty({
    description: '手续费',
    example: 0.0001,
  })
  fee: number;

  @ApiProperty({
    description: '实际到账金额',
    example: 1.4999,
  })
  actualAmount: number;
}

export class WhitelistAddressResponse {
  @ApiProperty({
    description: '地址ID',
    example: 'addr-123',
  })
  id: string;

  @ApiProperty({
    description: '用户ID',
    example: 'user-123',
  })
  userId: string;

  @ApiProperty({
    description: '币种',
    example: 'BTC',
  })
  currency: string;

  @ApiProperty({
    description: '链',
    example: 'BTC',
  })
  chain: string;

  @ApiProperty({
    description: '地址',
    example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  })
  address: string;

  @ApiProperty({
    description: '地址标签',
    example: 'Binance充值地址',
  })
  label: string;

  @ApiProperty({
    description: '创建时间',
  })
  createdAt: Date;

  @ApiProperty({
    description: '更新时间',
  })
  updatedAt: Date;
}
