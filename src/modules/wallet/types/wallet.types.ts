export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  address: string;
  balance: number;
  frozenBalance: number;
  totalDeposit: number;
  totalWithdraw: number;
  status: WalletStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  DISABLED = 'DISABLED',
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  currency: string;
  type: TransactionType;
  amount: number;
  fee: number;
  status: TransactionStatus;
  txHash?: string;
  confirmations?: number;
  fromAddress?: string;
  toAddress?: string;
  memo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  TRANSFER = 'TRANSFER',
  COMMISSION = 'COMMISSION',
  PROFIT_SHARING = 'PROFIT_SHARING',
  RANKING_REWARD = 'RANKING_REWARD',
  REFERRAL_REWARD = 'REFERRAL_REWARD',
  SYSTEM = 'SYSTEM',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface ChainConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  contracts?: {
    [key: string]: string; // token合约地址
  };
}

export interface CurrencyConfig {
  symbol: string;
  name: string;
  type: 'CRYPTO' | 'FIAT';
  chains: string[]; // 支持的链
  decimals: number;
  withdrawalFee: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  confirmations: number;
  isStableCoin: boolean;
  enabled: boolean;
}

export interface WithdrawalLimit {
  userId: string;
  currency: string;
  dailyLimit: number;
  dailyUsed: number;
  monthlyLimit: number;
  monthlyUsed: number;
  lastResetDaily: Date;
  lastResetMonthly: Date;
}

export interface AddressWhitelist {
  id: string;
  userId: string;
  currency: string;
  chain: string;
  address: string;
  label: string;
  enabled: boolean;
  createdAt: Date;
}

export interface WalletAuditLog {
  id: string;
  walletId: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'FREEZE' | 'UNFREEZE' | 'DISABLE';
  changes: Record<string, any>;
  reason?: string;
  operator: string;
  ipAddress: string;
  createdAt: Date;
}
