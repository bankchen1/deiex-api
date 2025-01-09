export interface Asset {
  id: string;
  userId: string;
  currency: string;
  balance: number;
  locked: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  currency: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  txHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRADE = 'trade',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
