import type { Prisma } from '@prisma/client';

export interface Wallet {
  id: string;
  userId: string;
  currency: string;
  address: string;
  available: string;
  locked: string;
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
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: string;
  amount: string;
  fee: string;
  txHash?: string;
  address?: string;
  chain?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ChainConfig {
  id: string;
  chain: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurrencyConfig {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  minDeposit: string;
  minWithdraw: string;
  withdrawFee: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WithdrawalLimit {
  id: string;
  userId: string;
  currency: string;
  dailyLimit: string;
  dailyUsed: string;
  monthlyLimit: string;
  monthlyUsed: string;
  lastResetDaily: Date;
  lastResetMonthly: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressWhitelist {
  id: string;
  userId: string;
  currency: string;
  chain: string;
  address: string;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletAuditLog {
  id: string;
  userId: string;
  walletId: string;
  action: string;
  changes: Record<string, any>;
  reason?: string;
  operator: string;
  ipAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma Types
export type WalletWhereInput = {
  id?: string;
  userId?: string;
  currency?: string;
  address?: string;
  available?: string;
  locked?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WalletWhereUniqueInput = {
  id?: string;
  userId_currency?: { userId: string; currency: string };
};

export type WalletCreateInput = {
  userId: string;
  currency: string;
  address: string;
  available?: string;
  locked?: string;
};

export type WalletUpdateInput = {
  currency?: string;
  address?: string;
  available?: string;
  locked?: string;
};

export type WalletTransactionWhereInput = {
  id?: string;
  userId?: string;
  type?: string;
  status?: string;
  currency?: string;
  txHash?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WalletTransactionWhereUniqueInput = {
  id?: string;
  txHash?: string;
};

export type WalletTransactionCreateInput = {
  userId: string;
  type: string;
  status: string;
  currency: string;
  amount: string;
  fee?: string;
  txHash?: string;
  address?: string;
  chain?: string;
};

export type WalletTransactionUpdateInput = {
  type?: string;
  status?: string;
  currency?: string;
  amount?: string;
  fee?: string;
  txHash?: string;
  address?: string;
  chain?: string;
};

export type WithdrawalLimitWhereInput = {
  id?: string;
  userId?: string;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WithdrawalLimitWhereUniqueInput = {
  id?: string;
  userId_currency?: { userId: string; currency: string };
};

export type WithdrawalLimitCreateInput = {
  userId: string;
  currency: string;
  dailyLimit: string;
  dailyUsed?: string;
  monthlyLimit: string;
  monthlyUsed?: string;
  lastResetDaily?: Date;
  lastResetMonthly?: Date;
};

export type WithdrawalLimitUpdateInput = {
  dailyLimit?: string;
  dailyUsed?: string;
  monthlyLimit?: string;
  monthlyUsed?: string;
  lastResetDaily?: Date;
  lastResetMonthly?: Date;
};

export type AddressWhitelistWhereInput = {
  id?: string;
  userId?: string;
  currency?: string;
  chain?: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AddressWhitelistWhereUniqueInput = {
  id?: string;
  userId_currency_address_chain?: { userId: string; currency: string; address: string; chain: string };
};

export type AddressWhitelistCreateInput = {
  userId: string;
  currency: string;
  chain: string;
  address: string;
  label?: string;
};

export type AddressWhitelistUpdateInput = {
  currency?: string;
  chain?: string;
  address?: string;
  label?: string;
};
