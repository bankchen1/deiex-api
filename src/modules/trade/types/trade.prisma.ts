import { Prisma } from '@prisma/client';

export type PrismaTradeInclude = Prisma.TradeInclude;
export type PrismaOrderInclude = Prisma.OrderInclude;
export type PrismaPositionInclude = Prisma.PositionInclude;

export interface PrismaTrade extends Prisma.TradeGetPayload<{
  include: { user: true }
}> {
  makerOrderId?: string | null;
  takerOrderId?: string | null;
  makerUserId?: string | null;
  takerUserId?: string | null;
  orderId?: string | null;
}

export type PrismaOrder = Prisma.OrderGetPayload<{
  include: { user: true; position: true }
}>;

export type PrismaPosition = Prisma.PositionGetPayload<{
  include: { user: true; orders: true }
}>;

export interface TradeCreateInput extends Prisma.TradeCreateInput {
  makerOrderId?: string | null;
  takerOrderId?: string | null;
  makerUserId?: string | null;
  takerUserId?: string | null;
  orderId?: string | null;
}

export interface TradeWhereInput extends Omit<Prisma.TradeWhereInput, 'OR'> {
  OR?: Array<{
    userId?: string;
    makerUserId?: string | null;
    takerUserId?: string | null;
    symbol?: string;
  }>;
  makerOrderId?: string | null;
  takerOrderId?: string | null;
  makerUserId?: string | null;
  takerUserId?: string | null;
  orderId?: string | null;
  symbol?: string;
}

export type TradeSelect = Prisma.TradeSelect;

export type OrderCreateInput = Prisma.OrderCreateInput;
export type OrderWhereInput = Prisma.OrderWhereInput;
export type OrderSelect = Prisma.OrderSelect;

export type PositionCreateInput = Prisma.PositionCreateInput;
export type PositionWhereInput = Prisma.PositionWhereInput;
export type PositionSelect = Prisma.PositionSelect; 